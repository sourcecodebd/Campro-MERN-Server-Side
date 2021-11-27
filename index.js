const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
require('dotenv').config();
var admin = require("firebase-admin");

var serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_DATA);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ombkm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const verifyToken = async (req, res, next) => {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(idToken);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}
const runCamproDatabase = async () => {
    try {
        await client.connect();
        const database = client.db('CamproDB');
        const usersCollection = database.collection('users');
        const adminsCollection = database.collection('admins');
        const cameraCollection = database.collection('cameras');
        const ordersCollection = database.collection('orders');
        const reviewsCollection = database.collection('reviews');
        const messageCollection = database.collection('message');
        // user - part
        // authentication methods
        // register
        app.post('/user/add', async (req, res) => {
            const newUser = req.body;
            console.log(newUser);
            const result = await usersCollection.insertOne(newUser);
            res.json(result);
        })
        // google-login
        app.put('/user/add', async (req, res) => {
            const newUser = req.body;
            console.log(newUser);
            const query = { email: newUser.email };
            const updateDoc = {
                $set: newUser
            }
            const options = { upsert: true };
            const result = await usersCollection.updateOne(query, updateDoc, options);
            res.json(result);
        })
        // get user by email
        app.get('/user', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.decodedEmail) {
                const filter = { email: email }
                const user = await usersCollection.findOne(filter);
                res.send(user);
            }
            else {
                res.status(401).json({ message: 'Warning: Attempt to Unauthorized Access!' })
            }
        })
        // single camera
        app.get('/camera/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const camera = await cameraCollection.findOne(query);
            res.send(camera);
        })
        // my orders
        app.get('/my-orders', verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.decodedEmail) {
                const filter = { email: email }
                const orders = await ordersCollection.find(filter).toArray();
                res.send(orders);
            }
            else {
                res.status(401).json({ message: 'Warning: Attempt to Unauthorized Access!' })
            }
        })
        // place order
        app.put('/order/place/:id', async (req, res) => {
            const newOrder = req.body;
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const updateDoc = {
                $set: newOrder
            };
            const options = { upsert: true };
            const result = await ordersCollection.updateOne(query, updateDoc, options);
            res.json(result);
        })
        // remove order
        app.delete('/order/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);
            res.json(result);
        })
        // reviews
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewsCollection.find({}).toArray();
            res.send(reviews);
        })
        // add review
        app.post('/review/add', async (req, res) => {
            const newReview = req.body;
            const result = await reviewsCollection.insertOne(newReview);
            res.json(result);
        })
        // all message to admin
        app.get('/messages', async (req, res) => {
            const messages = await messageCollection.find({}).toArray();
            res.send(messages);
        })
        // send message to admin
        app.post('/message/send', async (req, res) => {
            const newMessage = req.body;
            const result = await messageCollection.insertOne(newMessage);
            res.json(result);
        })

        // admin - part
        // all admins
        app.get('/admins', async (req, res) => {
            const admins = await adminsCollection.find({}).toArray();
            res.send(admins);
        })
        // admin verify
        app.get('/admin/verify', async (req, res) => {
            const email = req.query.email;
            const filter = { email: email };
            const admin = await adminsCollection.findOne(filter);
            let isAdmin = false;
            if (admin) {
                isAdmin = true;
            }
            res.json({ isAdmin });
        })
        // default admin
        const defaultAdmin = { name: 'Head Admin', email: 'admin@admin.com' }
        const updateDoc = { $set: defaultAdmin }
        const adminOptions = { upsert: true };
        await adminsCollection.updateOne({}, updateDoc, adminOptions);
        // make admin
        app.put('/admin/add', verifyToken, async (req, res) => {
            const newAdmin = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const query = { email: requester };
                const requesterAccount = await adminsCollection.findOne(query);
                if (requesterAccount) {
                    const filter = { email: newAdmin.email }
                    const updateDoc = { $set: newAdmin };
                    const options = { upsert: true };
                    const result = await adminsCollection.updateOne(filter, updateDoc, options);
                    res.json(result);
                }
                else {
                    res.status(401).json({ message: 'Warning: You do not have permission to acquire this role!' });
                }
            }
        })
        // kick an admin
        app.delete('/admin/remove/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await adminsCollection.deleteOne(query);
            res.json(result);
        })
        // all orders
        app.get('/orders', async (req, res) => {
            const orders = await ordersCollection.find({}).toArray();
            res.send(orders);
        })
        // manage order
        app.put('/manage-order/approve/:id', async (req, res) => {
            const id = req.params.id;
            const statusUpdate = req.body;
            const query = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: statusUpdate
            }
            const result = await ordersCollection.updateOne(query, updateDoc, options);
            res.json(result);
        })
        // all cameras
        app.get('/cameras/explore', async (req, res) => {
            const cameras = await cameraCollection.find({}).toArray();
            res.send(cameras);
        })
        // limited cameras
        app.get('/cameras/home', async (req, res) => {
            const cameras = await cameraCollection.find({}).limit(6).toArray();
            res.send(cameras);
        })
        // add camera
        app.post('/camera/add', async (req, res) => {
            const newCamera = req.body;
            const result = await cameraCollection.insertOne(newCamera);
            res.json(result);
        })
        // update camera
        app.put('/camera/update/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const updateCamera = req.body;
            const updateDoc = {
                $set: updateCamera
            }
            const options = { upsert: true };
            const result = await cameraCollection.updateOne(query, updateDoc, options);
            res.json(result);
        })
        // delete camera
        app.delete('/camera/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await cameraCollection.deleteOne(query);
            res.json(result);
        })
        // delete reviews
        app.delete('/reviews/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await reviewsCollection.deleteOne(query);
            res.json(result);
        })
    }
    finally {
        // await client.close();
    }
}
runCamproDatabase().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Campro server is running...');
})
app.listen(port, () => {
    console.log('Campro server is listening on port ' + port);
})