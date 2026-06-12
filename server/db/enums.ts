// Column domains shared by the db types and the route contracts

export const ORDER_TYPE_VALUES = ['platform', 'custom', 'work'] as const;

export type OrderType = (typeof ORDER_TYPE_VALUES)[number];
