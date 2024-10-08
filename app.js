const express = require('express');
const morgan = require('morgan');
const createError = require('http-errors');
const session = require("express-session");
const MongoDBStore = require('connect-mongodb-session')(session);
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');

const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs')

require('dotenv').config();
require('./helpers/init_mongodb');

const { verifyAccessToken } = require('./helpers/jwt_helper');
const AuthRoute = require('./routes/auth.route');
const AdminRoute = require('./routes/admin.route');
const ProductRoute = require('./routes/product.route');
const FileRoute = require('./routes/file.route');
const ShopRoute = require('./routes/shop.route');
const MarketRoute = require('./routes/market.route');
const SubscriptionRoute = require('./routes/subscription.route');
const PackageRoute = require('./routes/package.route');

const app = express();

/**
 * Load the OpenAPI specification
 * Serve Swagger API documentation
 */
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// app.use(cookieParser());

app.use(express.static('public'));
app.use('/uploads', express.static('public'));
app.use('/images', express.static('public'));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Local Development
// let uri = `${process.env.MONGODB_URI}/${process.env.DB_NAME}`

// Product
const uri = `mongodb+srv://pandopot:FVA7TI6h6kWChppk@cluster0.yjoup.gcp.mongodb.net/pandopot`;

const mongoDBStore = new MongoDBStore({
  uri: uri,
  collection: 'session',
  ttl: parseInt(process.env.SESSION_LIFETIME) / 1000
});
console.log('SESSION: ',  process.env.SESSION_SECRET)
app.use(session({
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: mongoDBStore,

  cookie: {
    maxAge: parseInt(process.env.SESSION_LIFETIME),
    sameSite: false, // this may need to be false is you are accessing from another React app
    httpOnly: false, // this must be false if you want to access the cookie
    secure: process.env.NODE_ENV === "production"
  }
}));

app.get('/', async (req, res, next) => {
  console.log(req.payload);
  res.send('Hello from pandopot');
});

app.get('/status', async (req, res, next) => {
let data = {
  dbusername: process.env.DB_USERNAME_PRO,
  dbnamepro: process.env.DB_NAME_PROD,
  dbpasspro: process.DB_PASS_PROD,

  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  accessTokenExp: process.env.ACCESS_TOKEN_EXP,
  refreshTokenExp: process.env.REFRESH_TOKEN_EXP,

  confirmTokenSecret: process.env.CONFIRM_TOKEN_SECRET,
  confirmTokenExp: process.env.CONFIRM_TOKEN_EXP,

  resetTokenSecret: process.env.RESET_TOKEN_SECRET,
  resetTokenExp: process.env.RESET_TOKEN_EXP,

  sessionName: process.env.SESSION_NAME,
  sessionSecret: process.env.SESSION_SECRET,
  sessionLifetime: process.env.SESSION_LIFETIME,

  emailUsername: process.env.EMAIL_USERNAME, 
  emaiPassword: process.env.EMAIL_PASSWORD,
  emailHost: process.env.EMAIL_HOST,
  appName: process.env.APP_NAME,

  apiEndPoint: process.env.API_ENDPOINT

}
  res.send(data);
});

app.use('/auth', AuthRoute);
app.use('/admin', AdminRoute);
app.use('/product', ProductRoute);
app.use('/media', FileRoute);
app.use('/shop', ShopRoute);
app.use('/market', MarketRoute);
app.use('/subscription', SubscriptionRoute);
app.use('/package', PackageRoute);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname)
  },
});

const fileFilter = (req, files, cb) => {
  console.log('file:', files)
  if (files.mimetype === 'image/png' || 
    files.mimetype === 'image/jpg' || 
    files.mimetype === 'image/jpeg'
  ){
    cb(null, true);
  }
  else {
    cb(null, true);
  }
}

const uploadStorage = multer();

app.post("/upload/multiple", uploadStorage.array("images", 10), (req, res) => {
  console.log(req.files)
  return res.send("Multiple files")
})

app.use(async (req, res, next) => {
  // const error = new Error('Not found');
  // error.status = 404;
  // next(error);

  const error = createError.NotFound('404 page not found zzz')
  next(error);
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);

  res.send({
    error: {
      status: err.status || 500,
      message: err.message
    }
  });
})

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});