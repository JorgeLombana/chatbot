import { Product } from '../entities';

/**
 * Search criteria for product queries based on CSV structure
 */
export interface ProductSearchCriteria {
  query?: string; // Search in displayTitle and embeddingText
  productType?: string; // Technology, Clothing, Home
  minPrice?: number;
  maxPrice?: number;
  hasDiscount?: boolean; // Filter by discount status (0 or 1)
  hasVariants?: boolean; // Filter products with/without variants
  limit?: number;
  offset?: number;
}

/**
 * Product search result with pagination
 */
export interface ProductSearchResult {
  products: Product[];
  total: number;
  hasMore: boolean;
}

/**
 * Interface for product repository operations
 * Defines the contract for product data access and search based on CSV structure
 */
export interface IProductRepository {
  /**
   * Search products based on criteria
   * @param criteria - Search parameters
   * @returns Promise resolving to search results
   */
  searchProducts(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;

  /**
   * Find product by display title (primary identifier in CSV)
   * @param displayTitle - Product display title
   * @returns Promise resolving to product or null if not found
   */
  findByDisplayTitle(displayTitle: string): Promise<Product | null>;

  /**
   * Find products by URL (unique identifier in CSV)
   * @param url - Product URL
   * @returns Promise resolving to product or null if not found
   */
  findByUrl(url: string): Promise<Product | null>;

  /**
   * Get all available product types (categories from CSV)
   * @returns Promise resolving to array of product types
   */
  getProductTypes(): Promise<string[]>;

  /**
   * Get products on discount (discount = 1)
   * @param limit - Optional limit for results
   * @returns Promise resolving to discounted products
   */
  getDiscountedProducts(limit?: number): Promise<Product[]>;

  /**
   * Get products by price range (parsing price string from CSV)
   * @param minPrice - Minimum price
   * @param maxPrice - Maximum price
   * @returns Promise resolving to products in price range
   */
  getProductsByPriceRange(
    minPrice: number,
    maxPrice: number,
  ): Promise<Product[]>;

  /**
   * Search products by embedding text content
   * @param query - Search query
   * @param limit - Optional result limit
   * @returns Promise resolving to matching products
   */
  searchByEmbeddingText(query: string, limit?: number): Promise<Product[]>;

  /**
   * Check if the repository is properly initialized and CSV is loaded
   * @returns Promise resolving to boolean indicating readiness
   */
  isReady(): Promise<boolean>;
}
