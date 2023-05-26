require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const Shopify = require("shopify-api-node");
const pipedrive = require("pipedrive");
const axios = require("axios");

const APIKey = process.env.APIKey;
const token = process.env.token;
const PASS = process.env.token;
const PORT = process.env.PORT || 3001;
const pipedriveToken = process.env.PIPEDRIVETOKEN;

app.use(cors());
app.use(express.json());

const shopify = new Shopify({
  shopName: "158a77",
  apiKey: APIKey,
  password: PASS,
});

// Create a new instance of the Pipedrive client
const defaultClient = new pipedrive.ApiClient();

// Configure API key authorization: apiToken
defaultClient.authentications.api_key.apiKey = pipedriveToken;

//  Step 1: Get Shopify order from order ID
async function getShopifyOrder(orderId) {
  shopify.order
    .get(orderId)
    .then((order) => {
      let details = {
        orderId: orderId,
        first_name: order.customer.first_name,
        last_name: order.customer.last_name,
        email: order.customer.email,
        phone: order.customer.phone,
        sku: order.line_items[0].sku,
        line_items: order.line_items,
      };

      console.log("Order:", details);
      return findOrCreatePersonInPipedrive(details);
    })
    .catch((err) => {
      console.error("Error retrieving order:", err);
      // Handle the error
    });
}

// Step 2: Find or create a person in Pipedrive based on Shopify customer details
async function findOrCreatePersonInPipedrive(details) {
  try {
    const searchResponse = await axios.get(
      "https://api.pipedrive.com/v1/persons/",
      {
        params: {
          api_token: pipedriveToken,
          term: details.email, // finding with shopify email
        },
      }
    );

    // Check if a matching person is found
    if (searchResponse.data.data && searchResponse.data.data.length > 0) {
      const existingPerson = searchResponse.data.data[0];
      // Use the existing person in the integration
      console.log("Existing Person");
      console.log(existingPerson);
      return findOrCreateProductsInPipedrive(
        details.line_items,
        existingPerson
      );
    }

    // No person found, create a new person in Pipedrive
    console.log("New Person");
    const createResponse = await axios.post(
      "https://api.pipedrive.com/v1/persons",
      {
        name: `${firstName} ${lastName}`,
        email: [{ label: "email", value: details.email, primary: true }],
        phone: [{ label: "phone", value: details.phone, primary: true }],
      },
      {
        params: {
          api_token: pipedriveToken,
        },
      }
    );

    const newPerson = createResponse.data.data;
    // Use the newly created person in the integration
    return findOrCreateProductsInPipedrive(details.line_items, newPerson);
  } catch (err) {
    console.log(err);
  }
}

// Step 3: Find or create products in Pipedrive based on line items
async function findOrCreateProductsInPipedrive(lineItems, person) {
  //   console.log("LINEITEMS", lineItems);
  console.log("PERSON", person);
  const createResponse = await axios.post(
    "https://api.pipedrive.com/v1/deals",
    {
      api_token: pipedriveToken,
      title: person.name,
    }
  );

  const newDeal = createResponse.data.data;
  // Use the newly created deal in further integration steps
  // For example, you can attach products or perform other actions related to the deal

  console.log("Deal created successfully:", newDeal);

  const products = [];

  for (const lineItem of lineItems) {
    const { sku, name, price } = lineItem;

    try {
      // Search for a product in Pipedrive using the sku field
      const searchResponse = await axios.get(
        "https://api.pipedrive.com/v1/products/find",
        {
          params: {
            api_token: pipedriveToken,
            term: sku,
          },
        }
      );

      // Check if a matching product is found
      if (searchResponse.data.data && searchResponse.data.data.length > 0) {
        const existingProduct = searchResponse.data.data[0];
        products.push(existingProduct);
      } else {
        // No product found, create a new product in Pipedrive
        const createResponse = await axios.post(
          "https://api.pipedrive.com/v1/products",
          {
            name: name,
            code: sku,
            prices: price,
          },
          {
            params: {
              api_token: pipedriveToken,
            },
          }
        );

        const newProduct = createResponse.data.data;
        products.push(newProduct);
      }
      return products;
    } catch (err) {
      console.log(err);
    }
  }
}

app.get("/", async (req, res) => {
  // available order ids : 5314286616891,5314281472315,
  const orderId = 5314286616891;
  try {
    console.log("get details");
    let details = await getShopifyOrder(orderId);
    res.send(details);
  } catch (err) {
    console.log(err);
    res.send(err);
  }
});

app.listen(PORT, () => {
  console.log("Server running at port", PORT);
});

// sample o/p for order details
// Order Details:
// {
//     orderId: 5314286616891,
//     first_name: 'Aniket',
//     last_name: 'Pandey',
//     email: 'aniketpandey2912@gmail.com',
//     phone: '+919956470719',
//     sku: '1'
// }

// to get all order ids
// shopify.order
//   .list()
//   .then((orders) => {
//     orders.forEach((order) => {
//       console.log("Order ID:", order.id);
//       // Handle the order details
//     });
//   })
//   .catch((err) => {
//     console.error("Error retrieving orders:", err);
//     // Handle the error
//   });
