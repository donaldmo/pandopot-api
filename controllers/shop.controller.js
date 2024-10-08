const User = require('../models/User.model');
const Product = require('../models/product.model');
const createError = require('http-errors');
const Order = require('../models/order.model');
const { pagenate } = require('../helpers/pagenate');

var axios = require('axios');
var qs = require('qs');
var btoa = require('btoa');
const Market = require('../models/market.model');
const sendEmail = require('../helpers/send_email');

exports.getProducts = async (req, res, next) => {
  try {
    const products = await Product.find();
    if (!products) throw createError.NotFound();

    res.send(products);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getCategoryProducts = async (req, res, next) => {
  try {
    let { size, page } = pagenate(req.query);
    const limit = parseInt(size);
    const skip = (parseInt(page) - 1) * parseInt(size);
    // console.log('limit: ', limit, 'skip: ', skip);

    if (!req.query.id) throw createError.BadRequest('No category id provided');
    // console.log('categoryId: ', req.query.id)
    const products = await Product.find({ "category.id": req.query.id }, {}, { limit, skip });
    // console.log('products 1: ', products[0]);

    if (!products) throw createError.NotFound();
    res.send(products);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id.toString() });
    if (!product) throw createError.NotFound('No product found');
    res.send(product);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.addToCart = async (req, res, next) => {
  try {
    const user = await User.findById(req.payload.aud);
    // console.log('add to cart: ', req.body)
    const product = await Product.findOne({ _id: req.body.id.toString() });
    if (!product) throw createError.NotFound('No product found');
    const saveCart = await user.addToCart(product, req.body.quantity);

    res.send(saveCart);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.updateCart = async (req, res, next) => {
  try {
    if (req.query) {
      const user = await User.findById(req.payload.aud);

      const product = await Product.findOne({ _id: req.query.id.toString() });
      if (!product) throw createError.NotFound('No product found');
      const saveCart = await user.addToCart(product, req.query.quantity);

      res.send(saveCart);
    }
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getCart = async (req, res, next) => {
  try {
    const userCart = await User.findOne({ _id: req.payload.aud })
      .populate('cart.items.productId').exec();

    if (!userCart) throw createError.NotFound('No product found');
    const cartProducts = userCart.cart.items
    res.send(cartProducts);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getCartItem = async (req, res, next) => {
  try {
    if (!req.params.id) throw createError.BadRequest('No cart item id provided');

    const userCart = await User.findOne({ _id: req.payload.aud });
    let cartItem = await userCart.getCartItem(req.params.id);
    if (!cartItem.length) throw createError.NotFound('Your cart is empty');

    let product = await Product.findById(cartItem[0].productId);
    if (!product) throw createError.NotFound('This product is no longer available');
    let cart = cartItem[0];

    res.send({ cart, product });
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.deleteCartItem = async (req, res, next) => {
  try {
    let { id } = req.params;
    if (!id) throw createError.BadRequest('No cart item id proiveded')
    const userCart = await User.findOne({ _id: req.payload.aud });
    const cartItemDelete = await userCart.removeFromCart(id);
    res.send(cartItemDelete);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.placeOrder = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.payload.aud })
      .populate('cart.items.productId').exec();

    if (user) {
      let products = user.cart.items.map(item => ({
        quantity: item.quantity,
        product: { ...item.productId._doc }
      }));

      const order = new Order({
        user: {
          name: user.firstName + ' ' + user.lastName,
          userId: user._id
        },
        products: products
      });

      // console.log(products)

      // let saveOrder = await order.save();
      // if (!saveOrder) throw createError.BadRequest('Failed to place an order');

      //send email to the client about the order

      res.send(order);
    }
  }
  catch (error) {
    // console.log(error)
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getOrders = async (req, res, next) => {
  try {
    // console.log('get orders')
    let orders = []
    let getOrders = await Order.find({ 'user.userId': req.payload.aud });

    if (getOrders.length) {
      getOrders.map(orderItem => {
        if (orderItem.order.length) {
          orderItem.order.map(orderProduct => {
            orders.push(orderProduct)
          });
        }
      })
    }

    // console.log(orders)
    res.send(getOrders);
  }
  catch (error) {

    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getCustomerOrders = async (req, res, next) => {
  try {
    let customersOrders = await Order.find({ 'productOwner.userId': req.payload.aud });

    // console.log(customersOrders)
    res.send(customersOrders);
  }
  catch (error) {

    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getOrderedProducts = async (req, res, next) => {
  try {
    let orders = []
    let getOrders = await Order.find({ 'productOwner.userId': req.payload.aud });

    if (getOrders.length) {
      getOrders.map(orderItem => {
        if (orderItem.order.length) {
          orderItem.order.map(orderProduct => {
            orders.push(orderProduct)
          });
        }
      })
    }

    res.send(getOrders);
  }
  catch (error) {

    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getOrderItem = async (req, res, next) => {
  try {
    let orderItem = await Order.findOne({
      "_id": req.params.id,
      "user.userId": req.payload.aud
    })
    // console.log('orderItem: ', orderItem)

    res.send(orderItem);
  }
  catch (error) {
    // console.log(error)
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.getCustomerSingleOrder = async (req, res, next) => {
  try {
    let orderItem = await Order.findOne({
      "_id": req.params.id,
      "productOwner.userId": req.payload.aud
    })

    res.send(orderItem);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.search = async (req, res, next) => {
  try {
    // console.log('query: ', req.query);
    let results = [];

    let { size, page } = pagenate(req.query);
    const limit = parseInt(size);
    const skip = (parseInt(page) - 1) * parseInt(size);

    let filter = {};
    let marketFilter = {};
    const { query, categoryId, categoryType } = req.query;
    if (query) filter = { ...filter, $text: { $search: query } };

    // if categoryType is Markets searh only market
    if (categoryType === 'market') {
      // console.log('searching market')
      if (categoryId) filter = { ...filter, "category.categoryId": categoryId };
      console.log('filter: ', filter);
      results = await Market.find(filter, {}, { limit, skip });
    }

    // if category type is 'product || undefined' search only products
    else if (categoryType === 'product') {
      // console.log('searching product')
      if (categoryId) filter = { ...filter, "category.id": categoryId };
      // console.log('filter: ', filter);
      results = await Product.find(filter, {}, { limit, skip });
    }

    else {
      if (query) marketFilter = { $text: { $search: query } };
      if (categoryId) {
        filter = { ...filter, "category.id": categoryId };
        marketFilter = { ...marketFilter, "category.categoryId": categoryId };
      }

      console.log('filter: ', filter);
      console.log('marketFilter: ', marketFilter);

      let results0 = await Product.find(filter, {}, { limit, skip });
      let results1 = await Market.find(marketFilter, {}, { limit, skip });
      console.log(results1)

      if (results0.length) results = [...results0];
      if (results1.length) results = [...results, ...results1];
    }
    // console.log('results:', results);

    res.send(results);
  }
  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.buyProduct = async (req, res, next) => {
  try {
    let orderProduct = await Product.findById(req.body.cartItem.productId);
    let user = await User.findById(req.payload.aud);

    let productAuthor;
    if (req.body.product) {
      productAuthor = await User.findById(req.body.product.author.userId);
    }

    if (req.body.payment && productAuthor) {
      let { id } = req.body.payment;
      let { amountInCents } = req.body;
      let currency = 'ZAR';
      const SECRET_KEY = productAuthor.paymentGateway.secret_key;

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
        console.log('payment: ', payment)

        let orderItem = {
          quantity: req.body.cartItem.quantity,
          product: orderProduct,
          payment: payment
        };

        const order = new Order({
          user: {
            name: user.firstName + ' ' + user.lastName,
            userId: user._id
          },
          order: orderItem,
          productOwner: {
            name: productAuthor.firstName + ' ' + productAuthor.lastName,
            userId: productAuthor._id
          }
        });

        let saveOrder = await order.save();
        if (!saveOrder) throw createError.BadRequest('Failed to place an order');
        // console.log(saveOrder);

        let removeCartItem = await user.removeFromCart(orderProduct._id);
        // send email to the client about the order
        let data = [];

        data.push({
          item: orderProduct.name,
          description: `ID: ${orderProduct._id}`,
          price: `R${orderProduct.price}`,
        });

        sendEmail.sendReceipt({
          package: data,
          email: user.email,
          username: user.firstName + ' ' + user.lastName,
          subject: 'Your order has been received'
        });

        res.send(saveOrder)
      })
        .catch(function (error) {
          // console.log(error);
          next(error)
        });
    }
    // console.log('btoa: ', btoa('sk_test_a27f36bfRgzl33N218448d5b44ac:'))
  }
  catch (error) {

    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}


exports.getBoostedProducts = async (req, res, next) => {
  try {
    // console.log('params: ', req.params);
    let products = [];
    let limitrecords = 4;

    if (req.params.boostName === 'featured') {
      let count = await Product.find({
        boostInfo: { $elemMatch: { name: "Featured Product", expiryDate: { $gt: Date.now() } } }
      }).count();

      var random = Math.floor(Math.random() * count)
      if (count > limitrecords) {
        // console.log('random: ', random)
        let whatLeft = (count - random);
        // console.log('whatLeft: ', whatLeft)
        if (whatLeft < limitrecords) random = count - limitrecords;
        // console.log('randomFinal: ', random)
      }
      else random = 0;

      products = await Product.find({
        boostInfo: { $elemMatch: { name: "Featured Product", expiryDate: { $gt: Date.now() } } }
      }).skip(random).limit(limitrecords)
    }

    if (req.params.boostName === 'slider') {
      let count = await Product.find({
        boostInfo: { $elemMatch: { name: "Slider", expiryDate: { $gt: Date.now() } } }
      }).count();

      var random = Math.floor(Math.random() * count)
      if (count > limitrecords) {
        // console.log('random: ', random)
        let whatLeft = (count - random);
        // console.log('whatLeft: ', whatLeft)
        if (whatLeft < limitrecords) random = count - limitrecords;
        // console.log('randomFinal: ', random)
      }
      else random = 0;

      products = await Product.find({
        boostInfo: { $elemMatch: { name: "Slider", expiryDate: { $gt: Date.now() } } }
      }).skip(random).limit(limitrecords);
    }

    res.send(products);
  }

  catch (error) {
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}

exports.contactUs = async (req, res, next) => {
  try {
    // console.log('body: ', req.body);
    sendEmail.contactUs({
      data: req.body
    });

    res.send({ message: 'message sent' });
  }

  catch (error) {
    // console.log(error);
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
}