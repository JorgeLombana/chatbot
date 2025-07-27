import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
  IsUrl,
  IsDateString,
} from 'class-validator';

/**
 * Product domain entity
 * Represents a product from the CSV catalog with all relevant information
 */
export class Product {
  @IsString()
  @MaxLength(500)
  displayTitle: string;

  @IsString()
  @MaxLength(1000)
  embeddingText: string;

  @IsUrl()
  @MaxLength(500)
  url: string;

  @IsUrl()
  @MaxLength(500)
  imageUrl: string;

  @IsString()
  @MaxLength(100)
  productType: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  discount: number; // 0 or 1 (boolean-like)

  @IsString()
  @MaxLength(50)
  price: string; // Price range like "13.0 - 15.0 USD" or "900.0 USD"

  @IsOptional()
  @IsString()
  @MaxLength(500)
  variants?: string;

  @IsDateString()
  createDate: string;

  constructor(data: Partial<Product> = {}) {
    this.displayTitle = data.displayTitle || '';
    this.embeddingText = data.embeddingText || '';
    this.url = data.url || '';
    this.imageUrl = data.imageUrl || '';
    this.productType = data.productType || '';
    this.discount = data.discount || 0;
    this.price = data.price || '0.0 USD';
    this.variants = data.variants;
    this.createDate = data.createDate || new Date().toISOString();
  }

  /**
   * Check if product has discount
   * @returns Boolean indicating if product is on sale
   */
  hasDiscount(): boolean {
    return this.discount === 1;
  }

  /**
   * Extract numeric price from price string
   * @returns Minimum price as number, or 0 if parsing fails
   */
  getNumericPrice(): number {
    const match = this.price.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Extract currency from price string
   * @returns Currency code (e.g., 'USD')
   */
  getCurrency(): string {
    const match = this.price.match(/([A-Z]{3})/);
    return match ? match[1] : 'USD';
  }

  /**
   * Check if product has variants (colors, sizes, etc.)
   * @returns Boolean indicating if product has variants
   */
  hasVariants(): boolean {
    return Boolean(this.variants && this.variants.trim().length > 0);
  }

  /**
   * Get product category from productType
   * @returns Category name
   */
  getCategory(): string {
    return this.productType || 'Unknown';
  }

  /**
   * Get product summary for display
   * @returns Concise product description
   */
  getSummary(): string {
    const discountSuffix = this.hasDiscount() ? ' (On Sale)' : '';
    return `${this.displayTitle} - ${this.price}${discountSuffix}`;
  }

  /**
   * Check if product matches search query
   * @param query - Search term
   * @returns Boolean indicating if product matches
   */
  matchesQuery(query: string): boolean {
    const searchText =
      `${this.displayTitle} ${this.embeddingText}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  /**
   * Get product variants as array
   * @returns Array of variant descriptions
   */
  getVariantsArray(): string[] {
    if (!this.variants) return [];
    return this.variants
      .split(',')
      .map((variant) => variant.trim())
      .filter((variant) => variant.length > 0);
  }
}
