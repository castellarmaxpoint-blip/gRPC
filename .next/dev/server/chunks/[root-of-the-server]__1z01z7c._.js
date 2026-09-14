module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/pages-api-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/pages/api/graphql.js [api] (ecmascript)", ((__turbopack_context__, module, exports) => {

__turbopack_context__.r("[externals]/dotenv [external] (dotenv, cjs, [project]/node_modules/dotenv)").config();
const { ApolloServer } = __turbopack_context__.r("[externals]/@apollo/server [external] (@apollo/server, cjs, [project]/node_modules/@apollo/server)");
const { startServerAndCreateNextHandler } = __turbopack_context__.r("[externals]/@as-integrations/next [external] (@as-integrations/next, cjs, [project]/node_modules/@as-integrations/next)");
const { Pool } = __turbopack_context__.r("[externals]/pg [external] (pg, cjs, [project]/node_modules/pg)");
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
        customers: async ()=>{
            const result = await pool.query("SELECT * FROM customers ORDER BY customer_id");
            return result.rows;
        },
        products: async ()=>{
            const result = await pool.query("SELECT * FROM products ORDER BY product_id");
            return result.rows;
        },
        orders: async ()=>{
            const result = await pool.query("SELECT * FROM orders ORDER BY order_id");
            return result.rows;
        },
        order: async (_, { order_id })=>{
            const result = await pool.query("SELECT * FROM orders WHERE order_id = $1", [
                order_id
            ]);
            return result.rows[0] || null;
        }
    },
    // ============================
    // ORDER RELATIONS
    // ============================
    Order: {
        customer: async (parent)=>{
            const result = await pool.query("SELECT * FROM customers WHERE customer_id = $1", [
                parent.customer_id
            ]);
            return result.rows[0];
        },
        product: async (parent)=>{
            const result = await pool.query("SELECT * FROM products WHERE product_id = $1", [
                parent.product_id
            ]);
            return result.rows[0];
        }
    },
    // ============================
    // CUSTOMER RELATIONS
    // ============================
    Customer: {
        orders: async (parent)=>{
            const result = await pool.query("SELECT * FROM orders WHERE customer_id = $1 ORDER BY order_id", [
                parent.customer_id
            ]);
            return result.rows;
        }
    },
    // ============================
    // PRODUCT RELATIONS
    // ============================
    Product: {
        orders: async (parent)=>{
            const result = await pool.query("SELECT * FROM orders WHERE product_id = $1 ORDER BY order_id", [
                parent.product_id
            ]);
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
// NEXT.JS GRAPHQL HANDLER
// ================================
const handler = startServerAndCreateNextHandler(server);
module.exports = async function graphqlHandler(req, res) {
    // CORS untuk Apollo Sandbox
    res.setHeader("Access-Control-Allow-Origin", "https://studio.apollographql.com");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    // Handle preflight request
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    return handler(req, res);
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1z01z7c._.js.map