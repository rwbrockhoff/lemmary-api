import type { VariantOption } from '../db/database-types.js';

export function extractBaseColor(variantLabel: VariantOption[] | null): string {
	if (!variantLabel || variantLabel.length === 0) return '';
	const colorVariant = variantLabel.find(
		(v) => v.name.toLowerCase() === 'color',
	);
	if (colorVariant) return colorVariant.value.split('(')[0].trim();
	return variantLabel[0].value.split('(')[0].trim();
}
