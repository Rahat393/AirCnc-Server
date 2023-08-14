const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

// Database Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lnoy20s.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const homesCollection = client.db("aircncdb").collection("homes");
    const usersCollection = client.db("aircncdb").collection("users");
    const bookingsCollection = client.db("aircncdb").collection("bookings");

    // send email
    const sendMail = (emailData, email) => {};

    // save user email and generate JWT
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      console.log(result);

      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      res.send({ result, token });
    });

    // save booking in db
    app.post("/bookings", async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      sendMail(
        {
          subject: "Booking Successful !",
          message: `Booking ID : ${result.insertedId}`,
        },
        booking?.guestEmail
      );
      res.send(result);
      console.log(result);
    });

    // get bookings by user
    app.get("/bookings", async (req, res) => {
      let query = {};
      const email = req.query.email;
      if (email) {
        query = {
          guestEmail: email,
        };
      }
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    // get a single user by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    // get all users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // add a home
    app.post("/homes", async (req, res) => {
      const homeData = req.body;
      const result = await homesCollection.insertOne(homeData);
      res.send(result);
    });

    // get all homes
    app.get("/homes", async (req, res) => {
      const query = {};
      const result = await homesCollection.find(query).toArray();
      res.send(result);
    });

    // Get Single Home
    app.get("/homes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const home = await homesCollection.findOne(query);
      res.send(home);
    });

    console.log("Database Connected... yaa");
  } finally {
  }
}

run().catch((err) => console.error(err));

app.get("/", (req, res) => {
  res.send("Server is running...");
});

app.listen(port, () => {
  console.log(`Server is running...on ${port}`);
});
