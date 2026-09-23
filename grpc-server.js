require("dotenv").config();

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const protoPath = path.join(__dirname, "product.proto");
const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const proto = grpc.loadPackageDefinition(packageDefinition);
const server = new grpc.Server();

async function GetProduct(call, callback) {
  const productId = Number(call.request.product_id ?? call.request.id ?? 0);

  if (!productId || Number.isNaN(productId)) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      details: "product_id harus berupa angka valid."
    });
  }

  try {
    const result = await pool.query(
      "SELECT product_id, name, category, price, stock FROM products WHERE product_id = $1",
      [productId]
    );

    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        details: `Produk dengan product_id ${productId} tidak ditemukan.`
      });
    }

    const product = result.rows[0];

    return callback(null, {
      product_id: Number(product.product_id),
      name: product.name,
      category: product.category,
      price: Number(product.price),
      stock: Number(product.stock)
    });
  } catch (error) {
    console.error("Database error:", error.message);
    return callback({
      code: grpc.status.INTERNAL,
      details: error.message
    });
  }
}

server.addService(proto.ProductService.service, {
  GetProduct
});

const port = process.env.PORT || 50051;

server.bindAsync(
  `0.0.0.0:${port}`,
  grpc.ServerCredentials.createInsecure(),
  (err, actualPort) => {
    if (err) {
      console.error("gRPC bind failed:", err);
      process.exit(1);
    }

    console.log(`🚀 gRPC server berjalan di 0.0.0.0:${actualPort}`);
    server.start();
  }
);

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});
