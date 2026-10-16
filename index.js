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
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60000,

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
    const sessionCollection = db.collection("session");


    //verification related
    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized Access" });
      }
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: "Unauthorized Access" });
      }

      const query = { token: token };
      const session = await sessionCollection.findOne(query);
      if (!session) {
        return res.status(401).json({ message: "Unauthorized Access" });
      }
      const userId = session?.userId;

      const userQuery = { _id: userId };
      const user = await userCollection.findOne(userQuery);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized Access" });
      }
      req.user = user;
      next();
    };

    //must be used after verifyToken middleware
    const verifySeeker = async (req, res, next) => {
      if (req.user?.role !== "seeker") {
        return res.status(403).json({ message: "Forbidden Access" });
      }
      next();
    }

    //must be used after verifyToken middleware
    const verifyRecruiter = async (req, res, next) => {
      if (req.user?.role !== "recruiter") {
        return res.status(403).json({ message: "Forbidden Access" });
      }
      next();
    }

    //must be used after verifyToken middleware
    const verifyAdmin = async (req, res, next) => {
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden Access" });
      }
      next();
    }



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
      // job filter related query
      if(req.query.search) {
        query.$or = [
          { jobTitle: { $regex: req.query.search, $options: "i" } },
          { companyName: { $regex: req.query.search, $options: "i" } },
          { jobCategory: { $regex: req.query.search, $options: "i" } },
          { requirements: { $regex: req.query.search, $options: "i" } },
          { responsibilities: { $regex: req.query.search, $options: "i" } },
        ];
      }
      if (req.query.jobCategory) {
        query.jobCategory = req.query.jobCategory;
      }
      if (req.query.jobType) {
        query.jobType = req.query.jobType;
      }

      // company related query
      if (req.query.companyId) {
        query.companyId = req.query.companyId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }

      //pagination related work
      if (req.query.page) {
        const page = parseInt(req.query.page);
        const perPage = parseInt(req.query.perPage) || 12;
        const skipItem = (page - 1) * perPage;
        const total = await jobCollection.countDocuments(query);

        const cursor = jobCollection.find(query).skip(skipItem).limit(perPage);
        const jobs = await cursor.toArray();
        return res.json({ total, jobs });
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
    app.get("/api/applications", verifyToken, verifySeeker, async (req, res) => {
      const query = {};
      if (req.query.applicantId) {
        query.applicantId = req.query.applicantId;
        if (req.user._id.toString() !== req.query.applicantId) {
          return res.status(403).json({ message: "Forbidden Access" });
        }
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
    //inefficient way to join/aggregate collection
    app.get("/api/companies", verifyToken, async (req, res) => {
      const cursor = companyCollection.find();
      const companies = await cursor.toArray();

      for (const company of companies) {
        const filter = {
          companyId: company._id.toString(),
        }
        const jobCount = await jobCollection.countDocuments(filter);
        company.jobCount = jobCount;
      }
      res.json(companies);
    });

    app.get("/api/companies2", async (req, res) => {
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

    app.patch("/api/companies/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedCompany = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDocument = {
        $set: {
          status: updatedCompany.status,
        },
      };
      const result = await companyCollection.updateOne(filter, updateDocument);
      res.json(result);
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
