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
   * Search products based on criteria (main method used by LLM service)
   * @param criteria - Search parameters
   * @returns Promise resolving to search results
   */
  searchProducts(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;
}
