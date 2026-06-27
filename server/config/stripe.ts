import Stripe from 'stripe';
import { env } from './environment.js';

let client: Stripe | null = null;

// Built on first use soapp boots without a key (tests, Shopify only stores)
export function getStripe(): Stripe {
	if (!client) {
		client = new Stripe(env.STRIPE_SECRET_KEY ?? '', { typescript: true });
	}
	return client;
}
