# SQL showcase

A walk-through of the more interesting analytics queries in this codebase. Most of them power the Performance dashboard — stage transitions, customer cohorts, promo usage, and material trends rolled into a single response.

---

## 1. Where do orders get stuck? (Stage bottleneck)

Average time an order spends in each workflow stage. Used to surface which stage is slowest in production.

```sql
WITH transitions AS (
  SELECT
    h.to_stage_id,
    h.transitioned_at,
    LEAD(h.transitioned_at) OVER (
      PARTITION BY h.order_id
      ORDER BY h.transitioned_at
    ) AS next_transition_at
  FROM order_stage_history h
  INNER JOIN orders o ON o.id = h.order_id
  WHERE o.store_id = $1
)
SELECT
  s.id AS stage_id,
  s.name AS stage_name,
  AVG(EXTRACT(EPOCH FROM (t.next_transition_at - t.transitioned_at))) AS avg_seconds,
  COUNT(*) AS transition_count
FROM transitions t
INNER JOIN order_workflow_stages s ON s.id = t.to_stage_id
WHERE t.next_transition_at IS NOT NULL
  AND t.transitioned_at >= NOW() - ($2 || ' days')::interval
GROUP BY s.id, s.name, s.position
ORDER BY s.position ASC
```

`LEAD()` grabs the next stage transition for each order, partitioned by order. The difference between consecutive timestamps is the total time spent in that stage. Filtering on `next_transition_at IS NOT NULL` drops the rows where the order is still sitting in its current stage — there's no next transition to measure against yet.

Source: [`performance-service.ts`](../server/routes/analytics/performance/performance-service.ts)

---

## 2. New vs returning customers, with prior-period comparison

Pulls four counts in one round-trip: current period new, current period returning, prior period new, prior period returning. The frontend uses the prior values to show a delta arrow.

```sql
WITH customer_first_order AS (
  SELECT
    customer_email,
    MIN(order_date) AS first_order_date
  FROM orders
  WHERE store_id = $1 AND customer_email IS NOT NULL
  GROUP BY customer_email
),
current_customers AS (
  SELECT DISTINCT customer_email
  FROM orders
  WHERE store_id = $1
    AND order_date >= NOW() - ($2 || ' days')::interval
    AND customer_email IS NOT NULL
),
current_repeat AS (
  SELECT DISTINCT o.customer_email
  FROM orders o
  INNER JOIN customer_first_order cfo USING (customer_email)
  WHERE o.store_id = $1
    AND o.order_date >= NOW() - ($2 || ' days')::interval
    AND o.order_date > cfo.first_order_date
)
-- prior_customers and prior_repeat follow the same pattern, shifted by one range
SELECT
  (SELECT COUNT(*) FROM current_repeat) AS current_returning,
  ((SELECT COUNT(*) FROM current_customers) - (SELECT COUNT(*) FROM current_repeat)) AS current_new,
  ...
```

A customer counts as "returning" in a given period only if they ordered at least once _before_ the period started. The `customer_first_order` CTE is queried once and reused for both periods, so it's still a single scan instead of redoing the lookup per period.

Source: [`performance-service.ts`](../server/routes/analytics/performance/performance-service.ts)

---

## 3. Conditional aggregation with FILTER

Coupon usage in the current and prior periods. Single pass over orders, four conditional counts.

```sql
SELECT
  COUNT(*) FILTER (
    WHERE order_date >= NOW() - ($2 || ' days')::interval
      AND promo_code IS NOT NULL
  ) AS current_with_promo,
  COUNT(*) FILTER (
    WHERE order_date >= NOW() - ($2 || ' days')::interval
  ) AS current_total,
  AVG(discount_total::numeric) FILTER (
    WHERE order_date >= NOW() - ($2 || ' days')::interval
      AND promo_code IS NOT NULL
  ) AS avg_discount
FROM orders
WHERE store_id = $1
```

Postgres's `FILTER` clause applies a separate WHERE condition to each aggregate, so the current and prior period counts share one pass over the orders table.

Source: [`performance-service.ts`](../server/routes/analytics/performance/performance-service.ts)

---

## 4. Material consumption trend, with low-baseline smoothing

Finds which materials saw the biggest period-over-period change in consumption. Each order item maps to multiple BOM rows, and each BOM row references a material with a measurement type (`linear`, `area`, `count`). So one order eats into many different material counts.

```sql
WITH consumption AS (
  SELECT
    bmt.name AS material_type,
    m.color,
    b.measurement,
    SUM(
      CASE
        WHEN b.measurement = 'linear'
          THEN COALESCE(b.length::numeric, 0) * b.quantity * oi.quantity
        ELSE b.quantity * oi.quantity
      END
    ) FILTER (
      WHERE o.order_date >= NOW() - ($2 || ' days')::interval
    ) AS current_qty,
    SUM(...) FILTER (
      WHERE o.order_date >= NOW() - ($2 * 2 || ' days')::interval
        AND o.order_date < NOW() - ($2 || ' days')::interval
    ) AS prior_qty
  FROM order_items oi
  INNER JOIN orders o ON o.id = oi.order_id
  INNER JOIN bom_items b ON b.platform_sku = oi.platform_sku AND b.store_id = $1
  INNER JOIN materials m ON m.id = b.material_id
  INNER JOIN bom_material_types bmt ON bmt.id = m.material_type_id
  WHERE o.store_id = $1
    AND o.order_date >= NOW() - ($2 * 2 || ' days')::interval
  GROUP BY bmt.id, bmt.name, m.color, b.measurement
)
SELECT material_type, color, measurement, current_qty, prior_qty
FROM consumption
WHERE current_qty > 0 AND prior_qty > 0 AND current_qty != prior_qty
ORDER BY (current_qty - prior_qty) / (prior_qty + 1) DESC
LIMIT 5
```

Two things worth pointing out:

**`(current - prior) / (prior + 1)` in the ORDER BY.** With small businesses, prior-period values are often tiny — going from 1 yard to 3 yards shows up as a 200% jump, which crowds out a more meaningful 50 → 80 change. The `+1` in the denominator softens the noise from small baselines without affecting big numbers much. The frontend formats the same way for the displayed delta so the sort order matches what users see.

**`CASE WHEN` inside the SUM.** Measurement types vary across materials — linear materials count length × quantity, count-based materials just count quantity. Folding both into one aggregate keeps it a single query instead.

Source: [`performance-service.ts`](../server/routes/analytics/performance/performance-service.ts)

---

## A few notes on style

- All queries are parameterized through Kysely's `sql` tag — no string interpolation, no SQL injection risk.
- Date ranges are computed in SQL (`NOW() - (n || ' days')::interval`) rather than being passed as start/end timestamps from the app. Keeps the timezone on one side (the database) and lets the frontend just send a range like `30` or `90`.
- Where it makes sense, current and prior periods are folded into a single query (CTEs or `FILTER`) instead of two round-trips.
