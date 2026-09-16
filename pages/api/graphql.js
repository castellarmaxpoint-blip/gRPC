require("dotenv").config();

const { ApolloServer } = require("@apollo/server");
const { startServerAndCreateNextHandler } = require("@as-integrations/next");
const { Pool } = require("pg");
const { ApolloServerPluginLandingPageLocalDefault } = require("@apollo/server/plugin/landingPage/default");

// ================================
// DATABASE CONNECTION
// ================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ================================
// GRAPHQL SCHEMA
// ================================

const typeDefs = `

  type Customer {
    customer_id: ID!
    name: String!
    email: String!
    phone: String
    city: String
    orders: [Order!]!
  }

  type Product {
    product_id: ID!
    name: String!
    category: String
    price: Float!
    stock: Int!
    orders: [Order!]!
  }

  type Order {
    order_id: ID!
    quantity: Int!
    order_date: String!
    status: String!
    customer: Customer!
    product: Product!
  }

  type Query {
    customers: [Customer!]!
    products(category: String): [Product!]!
    orders: [Order!]!
    order(order_id: ID!): Order
  }

  # ================================
  # INPUT TYPES UNTUK MUTATION
  # ================================

  input CreateProductInput {
    name: String!
    category: String
    price: Float!
    stock: Int!
  }

  input UpdateProductInput {
    name: String
    category: String
    price: Float
    stock: Int
  }

  # ================================
  # MUTATION
  # ================================

  type Mutation {
    createProduct(input: CreateProductInput!): Product!
    updateProduct(product_id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(product_id: ID!): Boolean!
  }

`;

// ================================
// COUNTER UNTUK N+1 DEMO
// (1 counter per resolver relasi, karena ada 2 pasangan
//  tabel yang berelasi: customers<->orders, products<->orders)
// ================================

let orderCustomerCount = 0;
let orderProductCount = 0;
let customerOrdersCount = 0;
let productOrdersCount = 0;

// ================================
// GRAPHQL RESOLVERS
// ================================

const resolvers = {

  Query: {

    customers: async () => {
      const result = await pool.query(
        "SELECT * FROM customers ORDER BY customer_id"
      );

      return result.rows;
    },

    // Sekarang mendukung filter opsional berdasarkan category
    products: async (_, { category }) => {
      if (category) {
        const result = await pool.query(
          "SELECT * FROM products WHERE category = $1 ORDER BY product_id",
          [category]
        );

        return result.rows;
      }

      const result = await pool.query(
        "SELECT * FROM products ORDER BY product_id"
      );

      return result.rows;
    },

    orders: async () => {
      const result = await pool.query(
        "SELECT * FROM orders ORDER BY order_id"
      );

      return result.rows;
    },

    order: async (_, { order_id }) => {
      const result = await pool.query(
        "SELECT * FROM orders WHERE order_id = $1",
        [order_id]
      );

      return result.rows[0] || null;
    }
  },

  // ============================
  // MUTATION RESOLVERS
  // ============================

  Mutation: {

    createProduct: async (_, { input }) => {
      const result = await pool.query(
        `INSERT INTO products (name, category, price, stock)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.name, input.category, input.price, input.stock]
      );

      return result.rows[0];
    },

    updateProduct: async (_, { product_id, input }) => {
      const result = await pool.query(
        `UPDATE products
         SET name = COALESCE($1, name),
             category = COALESCE($2, category),
             price = COALESCE($3, price),
             stock = COALESCE($4, stock)
         WHERE product_id = $5
         RETURNING *`,
        [input.name, input.category, input.price, input.stock, product_id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Product dengan id ${product_id} tidak ditemukan`);
      }

      return result.rows[0];
    },

    deleteProduct: async (_, { product_id }) => {
      const result = await pool.query(
        "DELETE FROM products WHERE product_id = $1 RETURNING *",
        [product_id]
      );

      // true kalau ada baris yang beneran kehapus, false kalau id-nya gak ketemu
      return result.rows.length > 0;
    }
  },

  // ============================
  // ORDER RELATIONS
  // ============================

  Order: {

    customer: async (parent) => {
      orderCustomerCount++;
      console.log(`🔢 Order.customer dipanggil ke-${orderCustomerCount} (order_id: ${parent.order_id})`);

      const result = await pool.query(
        "SELECT * FROM customers WHERE customer_id = $1",
        [parent.customer_id]
      );

      return result.rows[0];
    },

    product: async (parent) => {
      orderProductCount++;
      console.log(`🔢 Order.product dipanggil ke-${orderProductCount} (order_id: ${parent.order_id})`);

      const result = await pool.query(
        "SELECT * FROM products WHERE product_id = $1",
        [parent.product_id]
      );

      return result.rows[0];
    }
  },

  // ============================
  // CUSTOMER RELATIONS
  // ============================

  Customer: {

    orders: async (parent) => {
      customerOrdersCount++;
      console.log(`🔢 Customer.orders dipanggil ke-${customerOrdersCount} (customer_id: ${parent.customer_id})`);

      const result = await pool.query(
        "SELECT * FROM orders WHERE customer_id = $1 ORDER BY order_id",
        [parent.customer_id]
      );

      return result.rows;
    }
  },

  // ============================
  // PRODUCT RELATIONS
  // ============================

  Product: {

    orders: async (parent) => {
      productOrdersCount++;
      console.log(`🔢 Product.orders dipanggil ke-${productOrdersCount} (product_id: ${parent.product_id})`);

      const result = await pool.query(
        "SELECT * FROM orders WHERE product_id = $1 ORDER BY order_id",
        [parent.product_id]
      );

      return result.rows;
    }
  }
};

// ================================
// PLUGIN: MUNCULIN COUNTER DI RESPONSE (extensions)
// Ini TIDAK menambah field apapun ke schema/query.
// Nilainya disisipkan otomatis di luar "data", di bagian "extensions",
// setiap kali ada query yang dijalankan lewat Apollo Sandbox.
// ================================

const counterExtensionPlugin = {
  async requestDidStart() {
    return {
      async willSendResponse({ response }) {
        if (response.body.kind === "single") {
          response.body.singleResult.extensions = {
            resolverCallCounts: {
              "Order.customer": orderCustomerCount,
              "Order.product": orderProductCount,
              "Customer.orders": customerOrdersCount,
              "Product.orders": productOrdersCount,
            },
          };
        }
      },
    };
  },
};

// ================================
// APOLLO SERVER
// ================================

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  plugins: [
    ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    counterExtensionPlugin,
  ],
});

// ================================
// NEXT.JS GRAPHQL HANDLER
// ================================

const handler = startServerAndCreateNextHandler(server);

module.exports = async function graphqlHandler(req, res) {

  // CORS untuk Apollo Sandbox
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://studio.apollographql.com"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  return handler(req, res);
};