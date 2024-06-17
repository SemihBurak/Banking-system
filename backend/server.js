const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001; // Use environment variable or default to 3001

app.use(bodyParser.json());

const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

const pool = mysql.createPool(config);

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to database as ID " + connection.threadId);
    connection.release();
  } catch (err) {
    console.error("Database connection failed: " + err.stack);
    process.exit(1); // Exit the application if database connection fails
  }
})();

// Handle pool errors
pool.on("error", (err) => {
  console.error("MySQL Pool Error: " + err.stack);
});

app.post('/process_transaction', async (req, res) => {
  const { from_account_id, to_account_id, amount } = req.body;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [fromAccount] = await connection.execute('SELECT AccountBalance FROM Account WHERE AccountID = ?', [from_account_id]);
    const [toAccount] = await connection.execute('SELECT AccountBalance FROM Account WHERE AccountID = ?', [to_account_id]);

    if (fromAccount.length === 0 || toAccount.length === 0) {
      throw new Error('Invalid account ID');
    }

    if (fromAccount[0].AccountBalance < amount) {
      throw new Error('Insufficient funds in the source account.');
    }

    await connection.execute('UPDATE Account SET AccountBalance = AccountBalance - ? WHERE AccountID = ?', [amount, from_account_id]);
    await connection.execute('UPDATE Account SET AccountBalance = AccountBalance + ? WHERE AccountID = ?', [amount, to_account_id]);

    await connection.execute('INSERT INTO Transaction (TransactionType, TransactionAmount, TransactionDate, AccountID) VALUES (?, ?, ?, ?)', ['debit', amount, new Date(), from_account_id]);
    await connection.execute('INSERT INTO Transaction (TransactionType, TransactionAmount, TransactionDate, AccountID) VALUES (?, ?, ?, ?)', ['credit', amount, new Date(), to_account_id]);

    await connection.commit();
    connection.release();

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    res.json({ success: false, message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:3000`);
});

module.exports = pool;
