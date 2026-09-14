require("dotenv").config();

const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { Pool } = require("pg");

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
    products: [Product!]!
    orders: [Order!]!
    order(order_id: ID!): Order
  }

`;

// ================================
// GRAPHQL RESOLVERS
// ================================

const resolvers = {

  // ============================
  // QUERY RESOLVERS
  // ============================

  Query: {

    customers: async () => {
      const result = await pool.query(
        "SELECT * FROM customers ORDER BY customer_id"
      );

      return result.rows;
    },

    products: async () => {
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
  // ORDER RELATIONS
  // ============================

  Order: {

    customer: async (parent) => {
      const result = await pool.query(
        "SELECT * FROM customers WHERE customer_id = $1",
        [parent.customer_id]
      );

      return result.rows[0];
    },

    product: async (parent) => {
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
      const result = await pool.query(
        "SELECT * FROM orders WHERE product_id = $1 ORDER BY order_id",
        [parent.product_id]
      );

      return result.rows;
    }
  }
};

// ================================
// APOLLO SERVER
// ================================

const server = new ApolloServer({
  typeDefs,
  resolvers
});

// ================================
// START SERVER
// ================================

async function startServer() {

  const { url } = await startStandaloneServer(server, {
    listen: {
      port: 4000
    }
  });

  console.log(`🚀 GraphQL Server berjalan di ${url}`);
}

startServer();