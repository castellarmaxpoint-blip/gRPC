require("dotenv").config();

const { ApolloServer } = require("@apollo/server");
const { startServerAndCreateNextHandler } = require("@as-integrations/next");
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
  resolvers,
  introspection: true
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