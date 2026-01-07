const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json());

// 1) pune aici URI-ul tau
const MONGO_URI = "mongodb+srv://ioana:ioni@cluster0.ghgdp4h.mongodb.net/?retryWrites=true&w=majority";



// 2) numele bazei tale
const DB_NAME = "LateNightBites";

const client = new MongoClient(MONGO_URI);

let db, customers, restaurants, orders;

async function connect() {
  await client.connect();
  db = client.db(DB_NAME);
  customers = db.collection("customers");
  restaurants = db.collection("restaurants");
  orders = db.collection("orders");
  console.log("Connected to MongoDB:", DB_NAME);
}

app.get("/", (req, res) => {
  res.send("LateNightBites API is running");
});

/*
  GET /customers
  Returneaza customerii (read)
*/
app.get("/customers", async (req, res) => {
  const data = await customers
    .find({}, { projection: { name: 1, email: 1, loyaltyPoints: 1, preferences: 1 } })
    .sort({ loyaltyPoints: -1 })
    .toArray();

  res.json(data);
});

/*
  POST /customers
  Body: { name, email, preferences, loyaltyPoints }
*/
app.post("/customers", async (req, res) => {
  const doc = {
    name: req.body.name,
    email: req.body.email,
    preferences: req.body.preferences || { spicy: false, vegan: false },
    loyaltyPoints: req.body.loyaltyPoints ?? 0,
    createdAt: new Date()
  };

  const result = await customers.insertOne(doc);
  res.status(201).json({ insertedId: result.insertedId });
});

/*
  PATCH /customers/:id/points
  Body: { delta }
  Update (inc) points
*/
app.patch("/customers/:id/points", async (req, res) => {
  const delta = Number(req.body.delta || 0);

  const result = await customers.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $inc: { loyaltyPoints: delta } }
  );

  res.json({ matched: result.matchedCount, modified: result.modifiedCount });
});

/*
  DELETE /customers/:id
*/
app.delete("/customers/:id", async (req, res) => {
  const result = await customers.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ deleted: result.deletedCount });
});

/*
  POST /orders
  Body: { customerEmail, restaurantName, items: [{name, qty, unitPrice}] }
  Creeaza o comanda noua folosind date existente
*/
app.post("/orders", async (req, res) => {
  const customer = await customers.findOne({ email: req.body.customerEmail });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const restaurant = await restaurants.findOne({ name: req.body.restaurantName });
  if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

  const doc = {
    customerId: customer._id,
    restaurantId: restaurant._id,
    items: req.body.items || [],
    status: "placed",
    createdAt: new Date()
  };

  const result = await orders.insertOne(doc);
  res.status(201).json({ insertedId: result.insertedId });
});

/*
  GET /analytics/top-restaurants
  (Agregarea #2 a ta) Top restaurante dupa revenue (delivered)
*/
app.get("/analytics/top-restaurants", async (req, res) => {
  const data = await orders.aggregate([
    { $match: { status: "delivered" } },
    {
      $addFields: {
        total: {
          $sum: {
            $map: {
              input: "$items",
              as: "i",
              in: { $multiply: ["$$i.qty", "$$i.unitPrice"] }
            }
          }
        }
      }
    },
    {
      $group: {
        _id: "$restaurantId",
        revenue: { $sum: "$total" },
        ordersCount: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } },
    {
      $lookup: {
        from: "restaurants",
        localField: "_id",
        foreignField: "_id",
        as: "restaurant"
      }
    },
    { $unwind: "$restaurant" },
    {
      $project: {
        _id: 0,
        restaurantName: "$restaurant.name",
        cuisine: "$restaurant.cuisine",
        revenue: 1,
        ordersCount: 1
      }
    }
  ]).toArray();

  res.json(data);
});

connect()
  .then(() => {
    app.listen(3000, () => console.log("API running on http://localhost:3000"));
  })
  .catch((err) => {
    console.error("Mongo connection error:", err.message);
    process.exit(1);
  });
