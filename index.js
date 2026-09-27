require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("hireloop");
    console.log(`Connected to MongoDB database: ${db.databaseName}`);
    const jobCollection = db.collection("jobs");
    const companyCollection = db.collection("companies");
    const userCollection = db.collection("user");
    const applicationCollection = db.collection("applications");
    const planCollection = db.collection("plans");
    const subscriptionCollection = db.collection("subscriptions");

    app.get("/", (req, res) => {
      res.send("JobNest server is running");
    });

    app.get("/api/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.json(result);
    });

    app.get("/api/jobs", async (req, res) => {
      const query = {};
      if (req.query.companyId) {
        query.companyId = req.query.companyId;
      }

      if (req.query.status) {
        query.status = req.query.status;
      }
      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.json(result);
    });

    app.get("/api/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const result = await jobCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.post("/api/jobs", async (req, res) => {
      const job = req.body;
      const newJob = {
        ...job,
        createdAt: new Date(),
      };
      const result = await jobCollection.insertOne(newJob);
      res.json(result);
    });

    //application related api
    app.get("/api/applications", async (req, res) => {
      const query = {};
      if (req.query.applicantId) {
        query.applicantId = req.query.applicantId;
      }
      if (req.query.companyId) {
        query.companyId = req.query.companyId;
      }
      const cursor = applicationCollection.find(query);
      const result = await cursor.toArray();
      res.json(result);
    });

    app.post("/api/applications", async (req, res) => {
      const application = req.body;
      const newApplication = {
        ...application,
        createdAt: new Date(),
      };
      const result = await applicationCollection.insertOne(newApplication);
      res.send(result);
    });

    //company related api
    app.get("/api/companies", async (req, res) => {
      const cursor = companyCollection.find();
      const result = await cursor.toArray();
      res.json(result);
    });

    app.post("/api/companies", async (req, res) => {
      const company = req.body;
      const newCompany = {
        ...company,
        createdAt: new Date(),
      };
      const result = await companyCollection.insertOne(newCompany);
      res.send(result);
    });

    app.get("/api/my/company", async (req, res) => {
      try {
        const { recruiterId } = req.query;

        if (!recruiterId) {
          return res.status(400).json({ message: "recruiterId required" });
        }

        const result = await companyCollection.findOne({ recruiterId });

        res.json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "server error" });
      }
    });
    

    //Plans
    app.get("/api/plans", async (req, res) => {
      const query = {};
      if(req.query.plan_id){
        query.name = req.query.plan_id;
      }
      const plan = await planCollection.findOne(query);
      res.send(plan);
    });


    //Subscriptions
    app.post("/api/subscriptions", async (req, res) => {
      const data = req.body;
      const subscriptionInfo = {
        ...data,
        createdAt: new Date(),
      };
      const result = await subscriptionCollection.insertOne(subscriptionInfo);
      const filter = {email: data.email};
      const updateDocument ={
        $set: {
          plan: data.planId,
        }
      }
      const updatedResult = await userCollection.updateOne(filter, updateDocument);

      res.send(result, updatedResult);
    });


    app.listen(port, () => {
      console.log(`Express server is running on http://localhost:${port}`);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);
