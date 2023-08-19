const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
// const corsConfig = {
//   orgin: "",
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE"],
// };
app.use(cors());
// app.options("", cors(corsConfig));
app.use(express.json());

// Decode JWT
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    console.log(decoded);
    req.decoded = decoded;
    next();
  });
}

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

    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      console.log("Admin true");
      next();
    };

    // Send Email
    const sendMail = (emailData, email) => {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.APP_MAIL,
          pass: process.env.APP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.APP_MAIL,
        to: email,
        subject: emailData?.subject,
        html: `<p>${emailData?.message}</p>
          
        `,
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("Email sent: " + info.response);
        }
      });
    };

    // Create Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      console.log(price);
      const amount = parseFloat(price) * 100;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (err) {
        console.log(err);
      }
    });

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

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      console.log(result);
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
        bookingData?.guestEmail
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

    app.delete("/bookings/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // get a single user by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    // get all users
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // add a home
    app.post("/homes", verifyJWT, async (req, res) => {
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

    // Get All Homes for host
    app.get("/homes/:email", async (req, res) => {
      const email = req.params.email;
      // const decodedEmail = req.decoded.email;

      // if (email !== decodedEmail) {
      //   return res.status(403).send({ message: "forbidden access" });
      // }
      const query = {
        "host.email": email,
      };
      const cursor = homesCollection.find(query);
      const homes = await cursor.toArray();
      res.send(homes);
    });

    // Get Single Home
    app.get("/home/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const home = await homesCollection.findOne(query);
      res.send(home);
    });

    // Delete a home
    app.delete("/home/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await homesCollection.deleteOne(query);
      res.send(result);
    });

    // Get search result
    app.get("/search-result", async (req, res) => {
      const query = {};
      const location = req.query.location;
      if (location) query.location = location;
      const cursor = homesCollection.find(query);
      const homes = await cursor.toArray();
      res.send(homes);
    });

    // Update A Home
    app.put("/homes", async (req, res) => {
      const home = req.body;

      const filter = {};
      const options = { upsert: true };
      const updateDoc = {
        $set: home,
      };
      const result = await homesCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
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
