import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as csvParser from 'csv-parser';
import {
  IProductRepository,
  ProductSearchCriteria,
  ProductSearchResult,
} from '../interfaces';
import { Product } from '../entities';

/**
 * Interface for CSV row data structure
 * Defines the expected structure of each row from the CSV file
 */
interface CSVProductRow {
  displayTitle?: string;
  embeddingText?: string;
  url?: string;
  imageUrl?: string;
  productType?: string;
  discount?: string;
  price?: string;
  variants?: string;
  createDate?: string;
  [key: string]: string | undefined; // Allow additional fields
}

/**
 * CSV-based product repository implementation
 * Loads and manages product data with efficient search capabilities
 */
@Injectable()
export class CSVProductRepository implements IProductRepository, OnModuleInit {
  private readonly logger = new Logger(CSVProductRepository.name);
  private products: Product[] = [];
  private productTypes: string[] = [];
  private readonly csvPath: string;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.csvPath = this.configService.get<string>('data.productsPath')!;
  }

  async onModuleInit() {
    try {
      await this.loadProducts();
      this.logger.log(
        `Successfully loaded ${this.products.length} products from CSV`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize product repository', {
        error: error instanceof Error ? error.message : 'Unknown error',
        csvPath: this.csvPath,
      });
      throw error;
    }
  }

  private async loadProducts(): Promise<void> {
    const fullPath = path.resolve(this.csvPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`CSV file not found at: ${fullPath}`);
    }

    const products: Product[] = [];
    const productTypesSet = new Set<string>();

    return new Promise((resolve, reject) => {
      fs.createReadStream(fullPath)
        .pipe(csvParser())
        .on('data', (row: CSVProductRow) => {
          try {
            const discountValue = row.discount ? parseInt(row.discount, 10) : 0;
            const parsedDiscount = isNaN(discountValue)
              ? 0
              : Math.max(0, Math.min(1, discountValue));

            const product = new Product({
              displayTitle: this.sanitizeString(row.displayTitle),
              embeddingText: this.sanitizeString(row.embeddingText),
              url: this.sanitizeString(row.url),
              imageUrl: this.sanitizeString(row.imageUrl),
              productType: this.sanitizeString(row.productType),
              discount: parsedDiscount,
              price: this.sanitizeString(row.price) || '0.0 USD',
              variants: this.sanitizeString(row.variants),
              createDate:
                this.sanitizeString(row.createDate) || new Date().toISOString(),
            });

            if (product.displayTitle && product.url) {
              products.push(product);
              if (product.productType) {
                productTypesSet.add(product.productType);
              }
            } else {
              this.logger.warn('Skipping invalid product row', {
                displayTitle: product.displayTitle,
                url: product.url,
                rowData: this.getSafeRowSample(row),
              });
            }
          } catch (error) {
            this.logger.warn('Error parsing CSV row', {
              error: error instanceof Error ? error.message : 'Unknown error',
              rowData: this.getSafeRowSample(row),
            });
          }
        })
        .on('end', () => {
          this.products = products;
          this.productTypes = Array.from(productTypesSet).sort();
          this.isInitialized = true;
          this.logger.log(
            `Loaded ${products.length} products with ${this.productTypes.length} categories`,
          );
          resolve();
        })
        .on('error', (error) => {
          this.logger.error('Error reading CSV file', {
            error: error.message,
            csvPath: fullPath,
          });
          reject(error);
        });
    });
  }

  searchProducts(
    criteria: ProductSearchCriteria,
  ): Promise<ProductSearchResult> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Product repository not initialized'));
    }

    let filteredProducts = [...this.products];

    if (criteria.query?.trim()) {
      const query = criteria.query.toLowerCase().trim();
      filteredProducts = filteredProducts.filter((product) =>
        product.matchesQuery(query),
      );
    }

    if (criteria.productType?.trim()) {
      const type = criteria.productType.trim();
      filteredProducts = filteredProducts.filter(
        (product) => product.productType.toLowerCase() === type.toLowerCase(),
      );
    }

    if (criteria.hasDiscount !== undefined) {
      filteredProducts = filteredProducts.filter(
        (product) => product.hasDiscount() === criteria.hasDiscount,
      );
    }

    if (criteria.hasVariants !== undefined) {
      filteredProducts = filteredProducts.filter(
        (product) => product.hasVariants() === criteria.hasVariants,
      );
    }

    if (criteria.minPrice !== undefined || criteria.maxPrice !== undefined) {
      filteredProducts = filteredProducts.filter((product) => {
        const price = product.getNumericPrice();
        if (criteria.minPrice !== undefined && price < criteria.minPrice)
          return false;
        if (criteria.maxPrice !== undefined && price > criteria.maxPrice)
          return false;
        return true;
      });
    }

    // Sort by relevance: discounted products first, then by price
    filteredProducts.sort((a, b) => {
      if (a.hasDiscount() && !b.hasDiscount()) return -1;
      if (!a.hasDiscount() && b.hasDiscount()) return 1;
      return a.getNumericPrice() - b.getNumericPrice();
    });

    const total = filteredProducts.length;
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 20;
    const paginatedProducts = filteredProducts.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return Promise.resolve({
      products: paginatedProducts,
      total,
      hasMore,
    });
  }

  /**
   * Find product by display title
   */
  findByDisplayTitle(displayTitle: string): Promise<Product | null> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Product repository not initialized'));
    }

    const product = this.products.find(
      (p) => p.displayTitle.toLowerCase() === displayTitle.toLowerCase().trim(),
    );

    return Promise.resolve(product || null);
  }

  /**
   * Find product by URL
   */
  findByUrl(url: string): Promise<Product | null> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Product repository not initialized'));
    }

    const product = this.products.find((p) => p.url === url.trim());
    return Promise.resolve(product || null);
  }

  /**
   * Get all available product types
   */
  getProductTypes(): Promise<string[]> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Product repository not initialized'));
    }

    return Promise.resolve([...this.productTypes]);
  }

  /**
   * Get products on discount
   */
  getDiscountedProducts(limit: number = 10): Promise<Product[]> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Product repository not initialized'));
    }

    const discountedProducts = this.products
      .filter((product) => product.hasDiscount())
      .sort((a, b) => a.getNumericPrice() - b.getNumericPrice())
      .slice(0, limit);

    return Promise.resolve(discountedProducts);
  }

  /**
   * Get products by price range
   */
  getProductsByPriceRange(
    minPrice: number,
    maxPrice: number,
  ): Promise<Product[]> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Product repository not initialized'));
    }

    const productsInRange = this.products
      .filter((product) => {
        const price = product.getNumericPrice();
        return price >= minPrice && price <= maxPrice;
      })
      .sort((a, b) => a.getNumericPrice() - b.getNumericPrice());

    return Promise.resolve(productsInRange);
  }

  /**
   * Search products by embedding text content
   */
  searchByEmbeddingText(query: string, limit: number = 10): Promise<Product[]> {
    if (!this.isInitialized) {
      return Promise.reject(new Error('Product repository not initialized'));
    }

    const searchTerm = query.toLowerCase().trim();

    const matchingProducts = this.products
      .filter((product) =>
        product.embeddingText.toLowerCase().includes(searchTerm),
      )
      .sort((a, b) => {
        // Sort by relevance: products with query in title first
        const aInTitle = a.displayTitle.toLowerCase().includes(searchTerm);
        const bInTitle = b.displayTitle.toLowerCase().includes(searchTerm);

        if (aInTitle && !bInTitle) return -1;
        if (!aInTitle && bInTitle) return 1;

        // Then by discount status
        if (a.hasDiscount() && !b.hasDiscount()) return -1;
        if (!a.hasDiscount() && b.hasDiscount()) return 1;

        // Finally by price
        return a.getNumericPrice() - b.getNumericPrice();
      })
      .slice(0, limit);

    return Promise.resolve(matchingProducts);
  }

  /**
   * Check if repository is ready
   */
  isReady(): Promise<boolean> {
    return Promise.resolve(this.isInitialized && this.products.length > 0);
  }

  /**
   * Get repository statistics for debugging
   */
  getStats() {
    return {
      totalProducts: this.products.length,
      productTypes: this.productTypes.length,
      discountedProducts: this.products.filter((p) => p.hasDiscount()).length,
      productsWithVariants: this.products.filter((p) => p.hasVariants()).length,
      isInitialized: this.isInitialized,
      csvPath: this.csvPath,
    };
  }

  /**
   * Safely sanitize and trim string values from CSV
   * @param value - Raw value from CSV
   * @returns Cleaned string or empty string if invalid
   */
  private sanitizeString(value: string | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  /**
   * Get a safe sample of row data for logging (truncated to avoid large logs)
   * @param row - CSV row data
   * @returns Sanitized row sample for logging
   */
  private getSafeRowSample(row: CSVProductRow): Record<string, string> {
    const sample: Record<string, string> = {};
    const keyFields = [
      'displayTitle',
      'url',
      'productType',
      'price',
      'discount',
    ];

    for (const field of keyFields) {
      const value = row[field];
      if (typeof value === 'string') {
        sample[field] =
          value.length > 100 ? `${value.substring(0, 100)}...` : value;
      }
    }

    return sample;
  }
}
