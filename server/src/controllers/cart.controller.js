import Cart from "../models/cart.model.js";
import Test from "../models/test.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Function to aggregate items in a cart
const getCart = async (userId) => {
  const cartAggregation = await Cart.aggregate([
    {
      $match: {
        owner: userId,
      },
    },
    {
      $unwind: "$items",
    },
    {
      $lookup: {
        from: "tests",
        localField: "items.testId",
        foreignField: "_id",
        as: "test",
      },
    },
    {
      $project: {
        test: { $first: "$test" },
      },
    },
    {
      $group: {
        _id: "$_id",
        items: {
          $push: "$$ROOT",
        },
        cartTotal: {
          $sum: {
            $multiply: ["$test.price"],
          },
        },
      },
    },
  ]);

  return (
    cartAggregation[0] ?? {
      _id: null,
      items: [],
      cartTotal: 0,
    }
  );
};

// Controller to fetch user cart.
export const fetchUserCart = asyncHandler(async (req, res) => {
  const cart = await getCart(req.user._id);

  return res.status(200).json(new ApiResponse(200, cart));
});

// Controller to add or update item in a cart
export const addOrUpdateCart = asyncHandler(async (req, res) => {
  const { testId } = req.body;

  // Find the user's cart
  let cart = await Cart.findOne({
    owner: req.user._id,
  });

  const test = await Test.findById(testId);

  // Check if the test exists
  if (!test) {
    throw new ApiError(404, "Test does not exist");
  }

  // If no cart exists, create a new one
  if (!cart) {
    cart = new Cart({
      owner: req.user._id,
      items: [], // Initialize an empty array of items
    });
  }

  // Check if the test is already in the cart
  const addedTest = cart.items.find(
    (item) => item.testId.toString() === testId
  );

  // If the test isn't already in the cart, add it
  if (!addedTest) {
    cart.items.push({
      testId,
    });
  }

  // Save the cart (new or updated)
  await cart.save();

  // Get the updated cart to send back as response
  const newCart = await getCart(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, newCart, "Item added to the cart successfully"));
});

// Controller to remove item from the cart
export const removeFromCart = asyncHandler(async (req, res) => {
  const { testId } = req.params;

  const test = await Test.findById(testId);

  if (!test) {
    throw new ApiError(400, "Test does not exist");
  }

  const updatedCart = await Cart.findOneAndUpdate(
    {
      owner: req.user._id,
    },
    {
      $pull: {
        items: {
          testId: testId,
        },
      },
    },
    { new: true }
  );

  if (!updatedCart) {
    throw new ApiError(
      500,
      "Some error occured while removing the item from the cart"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedCart,
        "Item removed from the cart successfully"
      )
    );
});

export const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate(
    {
      owner: req.user._id,
    },
    {
      $set: {
        items: [],
      },
    },
    { new: true }
  );

  const cart = await getCart(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "All items are removed from cart"));
});