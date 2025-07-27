import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { CSVProductRepository } from '../infrastructure/csv-product.repository';
import { ProductSearchCriteria } from '../interfaces';

/**
 * DTO for product search test request
 */
class ProductSearchTestDto implements ProductSearchCriteria {
  @ApiProperty({
    description: 'Search query for product title and embedding text',
    example: 'iPhone',
    required: false,
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({
    description: 'Product category/type filter',
    example: 'Technology',
    required: false,
  })
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiProperty({
    description: 'Minimum price filter',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({
    description: 'Maximum price filter',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiProperty({
    description: 'Filter products with discount',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hasDiscount?: boolean;

  @ApiProperty({
    description: 'Filter products with variants',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  @ApiProperty({
    description: 'Number of results to return',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Number of results to skip',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

/**
 * Test controller for validating product repository functionality
 * Provides endpoints to test CSV product data loading and search
 */
@ApiTags('Product Repository Tests')
@Controller('test/products')
export class ProductTestController {
  private readonly logger = new Logger(ProductTestController.name);

  constructor(private readonly productRepository: CSVProductRepository) {}

  /**
   * Test product search endpoint
   */
  @Post('search')
  @ApiOperation({
    summary: 'Test product search',
    description: 'Search products from CSV with various filters and criteria',
  })
  @ApiBody({
    type: ProductSearchTestDto,
    description: 'Product search parameters',
  })
  async testSearch(@Body() criteria: ProductSearchTestDto) {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Testing product search with criteria: ${JSON.stringify(criteria)}`,
      );

      const result = await this.productRepository.searchProducts(criteria);
      const executionTime = `${Date.now() - startTime}ms`;

      this.logger.log(
        `Search completed: ${result.products.length} products returned, ${result.total} total (${executionTime})`,
      );

      return {
        success: true,
        data: {
          products: result.products.map((product) => ({
            displayTitle: product.displayTitle,
            productType: product.productType,
            price: product.price,
            discount: product.discount,
            hasDiscount: product.hasDiscount(),
            hasVariants: product.hasVariants(),
            url: product.url,
            imageUrl: product.imageUrl,
            summary: product.getSummary(),
          })),
          total: result.total,
          hasMore: result.hasMore,
          searchCriteria: criteria,
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Product search failed: ${errorMessage} (${executionTime})`,
      );

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get product types/categories
   */
  @Get('types')
  @ApiOperation({
    summary: 'Get product categories',
    description: 'Retrieve all available product types from CSV',
  })
  async getProductTypes() {
    const startTime = Date.now();

    try {
      const types = await this.productRepository.getProductTypes();
      const executionTime = `${Date.now() - startTime}ms`;

      return {
        success: true,
        data: {
          productTypes: types,
          total: types.length,
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get discounted products
   */
  @Get('discounted')
  @ApiOperation({
    summary: 'Get discounted products',
    description: 'Retrieve products that are on sale/discount',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of products to return',
    example: 10,
    required: false,
  })
  async getDiscountedProducts(@Query('limit') limit?: number) {
    const startTime = Date.now();

    try {
      const products = await this.productRepository.getDiscountedProducts(
        limit || 10,
      );
      const executionTime = `${Date.now() - startTime}ms`;

      return {
        success: true,
        data: {
          products: products.map((product) => ({
            displayTitle: product.displayTitle,
            productType: product.productType,
            price: product.price,
            numericPrice: product.getNumericPrice(),
            summary: product.getSummary(),
            url: product.url,
          })),
          total: products.length,
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Find product by title
   */
  @Get('by-title')
  @ApiOperation({
    summary: 'Find product by title',
    description: 'Find a specific product by its display title',
  })
  @ApiQuery({
    name: 'title',
    description: 'Product display title',
    example: 'iPhone 12',
  })
  async findByTitle(@Query('title') title: string) {
    const startTime = Date.now();

    try {
      if (!title?.trim()) {
        throw new HttpException(
          'Title query parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const product = await this.productRepository.findByDisplayTitle(title);
      const executionTime = `${Date.now() - startTime}ms`;

      if (!product) {
        return {
          success: true,
          data: {
            found: false,
            message: `Product with title "${title}" not found`,
          },
          executionTime,
        };
      }

      return {
        success: true,
        data: {
          found: true,
          product: {
            displayTitle: product.displayTitle,
            productType: product.productType,
            price: product.price,
            numericPrice: product.getNumericPrice(),
            hasDiscount: product.hasDiscount(),
            hasVariants: product.hasVariants(),
            variants: product.getVariantsArray(),
            summary: product.getSummary(),
            url: product.url,
            imageUrl: product.imageUrl,
            embeddingText: product.embeddingText.substring(0, 200) + '...',
          },
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test repository health and statistics
   */
  @Get('health')
  @ApiOperation({
    summary: 'Check product repository health',
    description: 'Verify repository status and get statistics',
  })
  async getHealth() {
    const startTime = Date.now();

    try {
      const isReady = await this.productRepository.isReady();
      const stats = this.productRepository.getStats();
      const executionTime = `${Date.now() - startTime}ms`;

      return {
        success: true,
        data: {
          ready: isReady,
          status: isReady
            ? 'Repository is ready and loaded'
            : 'Repository not ready',
          statistics: stats,
          timestamp: new Date().toISOString(),
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search by price range
   */
  @Get('price-range')
  @ApiOperation({
    summary: 'Get products by price range',
    description: 'Find products within a specific price range',
  })
  @ApiQuery({ name: 'min', description: 'Minimum price', example: 100 })
  @ApiQuery({ name: 'max', description: 'Maximum price', example: 500 })
  async getByPriceRange(
    @Query('min') minPrice: number,
    @Query('max') maxPrice: number,
  ) {
    const startTime = Date.now();

    try {
      if (!minPrice || !maxPrice || minPrice < 0 || maxPrice < minPrice) {
        throw new HttpException(
          'Valid min and max price parameters are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const products = await this.productRepository.getProductsByPriceRange(
        Number(minPrice),
        Number(maxPrice),
      );
      const executionTime = `${Date.now() - startTime}ms`;

      return {
        success: true,
        data: {
          products: products.map((product) => ({
            displayTitle: product.displayTitle,
            productType: product.productType,
            price: product.price,
            numericPrice: product.getNumericPrice(),
            hasDiscount: product.hasDiscount(),
            summary: product.getSummary(),
          })),
          total: products.length,
          priceRange: { min: minPrice, max: maxPrice },
        },
        executionTime,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new HttpException(
        {
          success: false,
          error: errorMessage,
          executionTime,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
