const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server is running at http://localhost:3000")
    );
  } catch (error) {
    console.log(`DB Error:${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticateToken = async (request, response, next) => {
  const token = request.headers["authorization"];
  let tokenNumber;
  if (token !== undefined) {
    tokenNumber = token.split(" ")[1];
  }
  if (tokenNumber === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonwebtoken.verify(tokenNumber, "chintu", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const getStateInCamelCase = (result) => {
  return {
    stateId: result.state_id,
    stateName: result.state_name,
    population: result.population,
  };
};

//get states
app.get("/states/", authenticateToken, async (request, response) => {
  const getQuery = `
    SELECT * FROM state;
  `;
  const result = await db.all(getQuery);
  response.send(result.map((eachState) => getStateInCamelCase(eachState)));
});

//get a specific state
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `
        SELECT * FROM state WHERE state_id=${stateId};
    `;
  const result = await db.get(getQuery);
  response.send(getStateInCamelCase(result));
});

//post a district
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
    INSERT INTO district (district_name,state_id,cases,cured,active,deaths) VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});
  `;
  await db.run(postQuery);
  response.send("District Successfully Added");
});

//get a specific district
const getDistrictInCamelCase = (result) => {
  return {
    districtId: result.district_id,
    districtName: result.district_name,
    stateId: result.state_id,
    cases: result.cases,
    cured: result.cured,
    active: result.active,
    deaths: result.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `
        SELECT * FROM district WHERE district_id=${districtId};
    `;
    const result = await db.get(getQuery);
    response.send(getDistrictInCamelCase(result));
  }
);

//delete a district
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
        DELETE FROM district WHERE district_id=${districtId};
    `;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//update district
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
        UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id=${districtId};
    `;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//total statics of state
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `
        SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM district WHERE state_id=${stateId};
    `;
    const result = await db.get(getQuery);
    response.send(result);
  }
);

//login page
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const payload = { username: username };
  const getData = `
        SELECT * FROM user WHERE username='${username}';
    `;
  const userDetails = await db.get(getData);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordMatched) {
      const jwt = jsonwebtoken.sign(payload, "chintu");
      response.send({ jwy: jwt });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

module.exports = app;
