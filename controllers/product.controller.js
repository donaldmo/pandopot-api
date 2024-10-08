const createError = require('http-errors');
const User = require('../models/User.model');
const ProductCategory = require('../models/product_categories.model');
const Subscription = require('../models/subscription.model');
const { productSchema, productUpdateSchema } = require('../helpers/validation_schema');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const { pagenate } = require('../helpers/pagenate');

var axios = require('axios');
var qs = require('qs');
var btoa = require('btoa');
const sendEmail = require('../helpers/send_email');

exports.getProducts = async (req, res, next) => {
  try {
    let { page, size } = pagenate(req.query);

    const limit = parseInt(size);
    const skip = (parseInt(page) - 1) * parseInt(size);
    // console.log('limit: ', limit, 'skip: ', skip);

    const products = await Product.find().limit(limit).skip(skip);
    if (!products) throw createError.NotFound();

    res.send(products);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getUserProducts = async (req, res, next) => {
  try {
    let { page, size } = pagenate(req.query);

    const limit = parseInt(size);
    const skip = (parseInt(page) - 1) * parseInt(size);
    // console.log('limit: ', limit, 'skip: ', skip);

    const products = await Product.find({
      "author.userId": req.payload.aud
    }).limit(limit).skip(skip);

    if (!products) throw createError.NotFound('No products found');
    res.send(products);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getUserProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.body.id,
      "author.userId": req.payload.aud
    });
    if (!product) throw createError.NotFound('No product found');
    res.send(product);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.addProduct = async (req, res, next) => {
  try {
    console.log('body: ', req.body, 'query: ', req.query)
    const user = await User.findOne({ _id: req.payload.aud });
    if (!user) throw createError.NotFound('User not registered');

    const result = await productSchema.validateAsync({
      name: req.body.name,
      category: req.body.category,
      payment: req.body.payment,
      price: req.body.price,
      description: req.body.description,
      delivery: req.body.delivery,
      deliveryPrice: req.body.deliveryPrice,
      units: req.body.units,
      province: req.body.province,
      city: req.body.city,
      subscriptionId: req.body.subscriptionId,
      reducedPrice: req.body.reducedPrice
    });

    const getCategory = await ProductCategory.findOne({ name: result.category });
    if (!getCategory) throw createError.BadRequest('Product category is not recognised.');

    result.category = {
      name: getCategory.name,
      id: getCategory._id,
      subCategory: req.body.subCategory || ''
    }

    const getSubscription = await Subscription.findOne({
      _id: req.query.subscriptionId,
      "subscriber.userId": req.payload.aud
    });

    if (!getSubscription) throw createError.BadRequest('No Subscription Found!');
    let { usage, expiryDate } = getSubscription._doc;
    // console.log('usage: ', usage, 'expiryData: ', expiryDate);

    if (usage.used === true) {
      throw createError.BadRequest('This subscription is already used');
    }

    const today = Date.now();

    if (today > expiryDate) {
      // console.log("Today is greater than Expiry Date.");
      throw createError.BadRequest('This subscription is expired!');
    }

    // console.log("Today is less than Expiry Date.");

    result.author = {
      name: user.firstName + user.lastName,
      userId: user._id
    }

    const product = new Product(result);
    let saveProduct = await product.save();
    console.log('saveProduct: ', saveProduct);

    let update = {
      usage: {
        used: true,
        usedDate: Date.now(),
        item: {
          itemType: 'product',
          name: product.name,
          itemId: product._id
        }
      }
    }

    const setUsed = await Subscription.findOneAndUpdate({ 
      _id: req.body.subscriptionId, 
      "subscriber.userId": req.payload.aud
    }, update);

    console.log('setUsed: ', setUsed);

    res.send({});
  }

  catch (error) {
    console.log(error);
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.deleteProduct = async (req, res, next) => {
  try {
    const deleteProduct = await Product.deleteOne({
      _id: req.params.id,
      "author.userId": req.payload.aud
    });
    if (deleteProduct.deletedCount === 0) {
      throw createError.BadRequest('Failed to delete');
    }

    res.send(deleteProduct);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.updateProduct = async (req, res, next) => {
  try {
    if (!req.body._id) {
      createError.BadRequest('No product id submitted, please provide one and try again.');
    }
    console.log('body: ', req.body)

    const getProduct = await Product.findById(req.body._id || req.body.id);
    // console.log('getProduct: ', getProduct);
    let update = {};

    let currentImages = getProduct.images || [];
    if (req.body.imagesUpdate) {
      if (!currentImages.length) update.images = req.body.images;
      else update.images = [...currentImages, ...req.body.images]
    }

    else if (Object.keys(req.body).length) {
      Object.keys(req.body).map(item => {
        // console.log(item, req.body[item]);
        update[item] = req.body[item]
      })
    }

    else {
      throw createError.BadRequest('No update info received');
    }

    let result = await productUpdateSchema.validateAsync(update);

    if (req.body.category) {
      const getCategory = await ProductCategory.findOne({ name: result.category });
      if (!getCategory) throw createError.BadRequest('Product category is not recognised.');

      result.category = {
        name: getCategory.name,
        id: getCategory._id
      }
    }

    const updateProduct = await Product.updateOne({
      _id: req.body.id,
      "author.userId": req.payload.aud
    }, result);

    if (updateProduct.nModified === 0) {
      throw createError.BadRequest('Failed to update');
    }

    res.send(updateProduct); console.log('updated this controller');
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getStoreProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id.toString() });
    if (!product) throw createError.NotFound('No product found');
    // console.log('product.controller.js: product: ', product)
    res.send(product);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}


exports.getPackage = async (req, res, next) => {
  try {
    const package = await Package.findOne({
      _id: req.body.id
    });

    if (!package) throw createError.NotFound();

    res.send(package);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.boostProduct = async (req, res, next) => {
  try {
    // console.log('body: ', req.body.boostData[0]);
    const user = await User.findOne({ _id: req.payload.aud });
    const admin = await User.findOne({ role: 'admin' });

    const product = await Product.findOne({
      _id: req.body.productId,
      "author.userId": req.payload.aud
    });

    if (!product) throw createError.NotFound('Product not available');

    if (req.body.payment && product && admin) {
      let { id } = req.body.payment;
      let { amountInCents } = req.body;
      let currency = 'ZAR';
      const SECRET_KEY = admin.paymentGateway.secret_key;

      var data = qs.stringify({
        'token': id,
        'amountInCents': amountInCents,
        'currency': currency
      });

      var config = {
        method: 'post',
        url: 'https://online.yoco.com/v1/charges/',
        headers: {
          'Authorization': `Basic ${btoa(SECRET_KEY)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: data
      };

      axios(config).then(async (response) => {
        // console.log(JSON.stringify(response.data));
        let payment = response.data;
        // console.log('payment: ', payment);

        let { boostData } = req.body;
        // console.log('boostData: ', boostData)

        let { boostInfo } = product;
        // console.log('boostInfo: ', boostInfo);
        let ProductFeaturedAndNotExpired = false;
        let ProductSliderAndNotExipired = false;

        if (boostInfo) boostInfo.map(boost => {
          // console.log('boost: ', boost);
          let expired = Date.now() > boost.expiryDate;

          if (boost.name == 'Featured Product' && !expired) {
            // console.log('now: ', Date.now(), ' exp: ', boost.expiryDate);
            ProductFeaturedAndNotExpired = true;
          }

          if (boost.name == 'Slider' && !expired) ProductSliderAndNotExipired = true;
        });

        let data = []
        boostData.map(item => {
          // console.log('boostDataItem: ', item);

          if (ProductFeaturedAndNotExpired && item.name === 'Featured Product') {
            throw createError.BadRequest('This product is already FEATURED & not yet expired');
          }

          if (ProductSliderAndNotExipired && item.name === 'Slider') {
            throw createError.BadRequest('Producct SLIDER already purchased & not yet expired')
          }

          let days = parseInt(item.expiryDate.days); // set to expired in 30 days
          var now = new Date().getTime();
          futureDate = now + (1000 * 60 * 60 * 24 * days);

          boostInfo.push({
            name: item.name,
            price: item.price,
            description: item.description,
            boostId: item._id,
            expiryDate: futureDate,
            createdAt: Date.now()
          });

          data.push({
            name: item.name,
            price: `R${item.price}`,
            expiryDate: new Date(futureDate).toLocaleDateString("en-US")
          })
        });

        product.boostInfo = boostInfo;
        let saveBoost = await product.save();

        // console.log('saveBoost: ', saveBoost);
        // console.log('newBoostInfo: ', boostInfo);
        // console.log('data: ', data)

        sendEmail.sendReceipt({
          package: data,
          email: user.email,
          username: user.firstName + ' ' + user.lastName,
          subject: 'Pandopot Product Boost Purchase'
        });

        res.send(saveBoost);
      })
        .catch(function (error) {
          console.log(error);
          next(error);
        });
    }
  }  // end try

  catch (error) {
    // console.log(error)
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getPlantsTypes = async (req, res, next) => {
  try {
    let filter = {};
    // console.log(req.query)

    let subCategory = req.query.subCategory;
    if (subCategory !== undefined && subCategory !== '') {
      filter = {
        "category.subCategory": subCategory
      }
    }
    // console.log('filter: ', filter);

    const plantsTypes = await Product.find(filter);

    // console.log('plantsTypes:: herbs: ', plantsTypes);

    res.send(plantsTypes);
  }

  catch (error) {
    // console.log(error)
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}