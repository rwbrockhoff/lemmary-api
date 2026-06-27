import Stripe from 'stripe';
import { env } from './environment.js';

// Key is optional
export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '', {
	typescript: true,
});
