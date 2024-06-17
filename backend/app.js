const pool = require('./server');
const express = require("express");
const app = express();
const cors = require("cors");
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const session = require('express-session');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

app.use(cors({ origin: "https://localhost:3000" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.use(session({
  secret: 'your secret key',
  resave: false,
  saveUninitialized: true,
}));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/loginEmployee', async function (req, res) {
    console.log('Received login request:', req.body);
  
    const { EmployeeID, EmployeePassword } = req.body;
  
    try {
      const [rows] = await pool.execute('SELECT EmployeePassword FROM Employee WHERE EmployeeID = ?', [EmployeeID]);
  
      console.log('Database query result:', rows);
  
      if (rows.length === 0) {
        return res.json({ status: 'fail', message: 'User not found' });
      }
  
      const user = rows[0];
  
      console.log('Password :', EmployeePassword);
      console.log('Password hash:', user.EmployeePassword);     
  
      if (EmployeePassword === user.EmployeePassword) {
        return res.json({ status: 'success', message: 'Login successful' });
      } else {
        return res.json({ status: 'fail', message: 'Invalid password' });
      }
    } catch (err) {
      console.error('Error executing query', err.stack);
      return res.json({ status: 'fail', message: 'An error occurred' });
    }
  });

  app.post('/login', async function (req, res) {
    console.log('Received login request:', req.body);
  
    const { CustomerID, CustomerPassword } = req.body;
  
    try {
      const [rows] = await pool.execute('SELECT CustomerPassword, FirstName FROM Customer WHERE CustomerID = ?', [CustomerID]);
  
      console.log('Database query result:', rows);
  
      if (rows.length === 0) {
        return res.json({ status: 'fail', message: 'User not found' });
      }
  
      const user = rows[0];
  
      if (!user) {
        console.error('User not found');
        return res.json({ status: 'fail', message: 'User not found' });
      }
  
      console.log('Password :', CustomerPassword);
      console.log('Password hash:', user.CustomerPassword);     
  
      if (CustomerPassword === user.CustomerPassword) {
        req.session.CustomerID = CustomerID;
        req.session.FirstName = user.FirstName;
        return res.json({ status: 'success', message: 'Login successful', FirstName: user.FirstName });
      } else {
        return res.json({ status: 'fail', message: 'Invalid password' });
      }
    } catch (err) {
      console.error('Error executing query', err.stack);
      return res.json({ status: 'fail', message: 'An error occurred' });
    }
  });
  
app.get('/customerDetails', async function (req, res) {
  const CustomerID = req.session.CustomerID;

  if (!CustomerID) {
      return res.status(401).json({ status: 'fail', message: 'Not authenticated' });
  }

  try {
      const [rows] = await pool.execute('SELECT FirstName FROM Customer WHERE CustomerID = ?', [CustomerID]);

      if (rows.length === 0) {
          return res.status(404).json({ status: 'fail', message: 'User not found' });
      }

      const user = rows[0];
      res.json({ status: 'success', FirstName: user.FirstName });
  } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ status: 'fail', message: 'An error occurred' });
  }
});

app.get('/customerProfile', async function (req, res) {
  const CustomerID = req.session.CustomerID;

  if (!CustomerID) {
      return res.status(401).json({ status: 'fail', message: 'Not authenticated' });
  }

  try {
      const [rows] = await pool.execute('SELECT CustomerID, FirstName, LastName, DateofBirth, Email, PhoneNumber FROM Customer WHERE CustomerID = ?', [CustomerID]);

      if (rows.length === 0) {
          return res.status(404).json({ status: 'fail', message: 'User not found' });
      }

      const user = rows[0];
      res.json({ status: 'success', profile: user });
  } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ status: 'fail', message: 'An error occurred' });
  }
});

app.post('/updateProfile', async function (req, res) {
  const { CustomerID, FirstName, LastName, DateofBirth, Email, PhoneNumber } = req.body;

  if (!CustomerID) {
      return res.status(400).json({ status: 'fail', message: 'Customer ID is required' });
  }

  try {
      const [result] = await pool.execute(
          'UPDATE Customer SET FirstName = ?, LastName = ?, DateofBirth = ?, Email = ?, PhoneNumber = ? WHERE CustomerID = ?',
          [FirstName, LastName, DateofBirth, Email, PhoneNumber, CustomerID]
      );

      if (result.affectedRows === 0) {
          return res.status(404).json({ status: 'fail', message: 'User not found' });
      }

      res.json({ status: 'success', message: 'Profile updated successfully' });
  } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ status: 'fail', message: 'An error occurred' });
  }
});

app.get('/accountInfo', async function (req, res) {
  const { AccountID } = req.query;

  if (!AccountID) {
      return res.status(400).json({ status: 'fail', message: 'AccountID is required' });
  }

  try {
      const [rows] = await pool.execute('SELECT AccountID, AccountBalance FROM Account WHERE AccountID = ?', [AccountID]);

      if (rows.length === 0) {
          return res.status(404).json({ status: 'fail', message: 'Account not found' });
      }

      const account = rows[0];
      res.json({ status: 'success', account });
  } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ status: 'fail', message: 'An error occurred' });
  }
});

app.get('/loans', async function (req, res) {
  const CustomerID = req.session.CustomerID;

  if (!CustomerID) {
    return res.status(401).json({ status: 'fail', message: 'Not authenticated' });
  }

  try {
    const [rows] = await pool.execute(`
      SELECT l.LoanID, l.LoanType, l.LoanAmount, (l.LoanAmount + COALESCE(SUM(lp.PaymentAmount), 0)) AS PaidAmount, l.LoanStatus
      FROM Loan l
      LEFT JOIN LoanPayment lp ON l.LoanID = lp.LoanID
      WHERE l.CustomerID = ?
      GROUP BY l.LoanID`, 
      [CustomerID]);

    if (rows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'No loans found' });
    }

    res.json({ status: 'success', loans: rows });
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).json({ status: 'fail', message: 'An error occurred' });
  }
});


// Add endpoint to fetch loan payment details
app.get('/loanPaymentDetails', async function (req, res) {
  const { LoanID } = req.query;

  if (!LoanID) {
    return res.status(400).json({ status: 'fail', message: 'LoanID is required' });
  }

  try {
    const [rows] = await pool.execute(`
      SELECT lp.PrincipalAmount, lp.InterestAmount
      FROM LoanPayment lp
      WHERE lp.LoanID = ?
      ORDER BY lp.LoanPaymentID DESC
      LIMIT 1`, 
      [LoanID]);

    if (rows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'No payment details found' });
    }

    res.json({ status: 'success', paymentDetails: rows[0] });
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).json({ status: 'fail', message: 'An error occurred' });
  }
});

// Add endpoint to handle loan payments
app.post('/payLoan', async function (req, res) {
  const { LoanID, PaymentAmount } = req.body;

  if (!LoanID || !PaymentAmount) {
    return res.status(400).json({ status: 'fail', message: 'LoanID and PaymentAmount are required' });
  }

  try {
    const [loanRows] = await pool.execute('SELECT LoanAmount FROM Loan WHERE LoanID = ?', [LoanID]);
    if (loanRows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Loan not found' });
    }

    const loanAmount = loanRows[0].LoanAmount;
    const newLoanAmount = loanAmount;

    if (newLoanAmount < 0) {
      return res.status(400).json({ status: 'fail', message: 'Payment amount exceeds loan amount' });
    }

    await pool.execute('UPDATE Loan SET LoanAmount = ? WHERE LoanID = ?', [newLoanAmount, LoanID]);
    await pool.execute('INSERT INTO LoanPayment (LoanID, PaymentAmount, PaidAmount, InterestAmount, PrincipalAmount) VALUES (?, ?, ?, ?, ?)', 
      [LoanID, PaymentAmount, PaymentAmount, 0, PaymentAmount]);

    res.json({ status: 'success', message: 'Loan payment successful' });
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).json({ status: 'fail', message: 'An error occurred' });
  }
});

app.get('/transactions', async function (req, res) {
  const AccountID = req.session.AccountID;

  if (!AccountID) {
    return res.status(401).json({ status: 'fail', message: 'Not authenticated' });
  }

  try {
    const [rows] = await pool.execute('SELECT TransactionID, TransactionType, TransactionAmount, TransactionDate FROM Transaction WHERE AccountID = ?', [AccountID]);

    if (rows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'No transactions found' });
    }

    res.json({ status: 'success', transactions: rows });
  } catch (err) {
    console.error('Error executing query', err.stack);
    res.status(500).json({ status: 'fail', message: 'An error occurred' });
  }
});

app.post('/newTransaction', async function (req, res) {
  const { fromAccountID, toAccountID, amount } = req.body;

  if (!fromAccountID || !toAccountID || !amount) {
    return res.status(400).json({ status: 'fail', message: 'All fields are required' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [fromAccount] = await connection.execute('SELECT AccountBalance FROM Account WHERE AccountID = ?', [fromAccountID]);
    const [toAccount] = await connection.execute('SELECT AccountBalance FROM Account WHERE AccountID = ?', [toAccountID]);

    if (fromAccount.length === 0 || toAccount.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'fail', message: 'One or both accounts not found' });
    }

    const fromAccountBalance = fromAccount[0].AccountBalance;
    const toAccountBalance = toAccount[0].AccountBalance;

    if (fromAccountBalance < amount) {
      await connection.rollback();
      return res.status(400).json({ status: 'fail', message: 'Insufficient funds in from account' });
    }

    await connection.execute('UPDATE Account SET AccountBalance = ? WHERE AccountID = ?', [fromAccountBalance - amount, fromAccountID]);
    await connection.execute('UPDATE Account SET AccountBalance = ? WHERE AccountID = ?', [toAccountBalance + amount, toAccountID]);

    await connection.execute('INSERT INTO Transaction (TransactionType, TransactionAmount, TransactionDate, AccountID) VALUES (?, ?, NOW(), ?)', 
      ['Debit', amount, fromAccountID]);
    await connection.execute('INSERT INTO Transaction (TransactionType, TransactionAmount, TransactionDate, AccountID) VALUES (?, ?, NOW(), ?)', 
      ['Credit', amount, toAccountID]);

    await connection.commit();
    res.json({ status: 'success', message: 'Transaction completed successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('Error executing transaction', err.stack);
    res.status(500).json({ status: 'fail', message: 'An error occurred' });
  } finally {
    connection.release();
  }
});

app.post('/process_transaction', async (req, res) => {
  const { from_account_id, to_account_id, amount } = req.body;

  try {
      const connection = await mysql.createConnection(dbConfig);
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
      await connection.end();

      res.json({ success: true });
  } catch (error) {
      console.error(error);
      if (connection) {
          await connection.rollback();
      }
      res.json({ success: false, message: error.message });
  }
});




// Define a POST route for "/register"
app.post('/register', async function (req, res) {
    const { FirstName, LastName, Email, Password, Gender } = req.body;
  
    console.log('Received registration request:', { FirstName, LastName, Email, Password, Gender });
  
    try {
      // Save the user to the database
      await pool.query('INSERT INTO Customer (FirstName, LastName, Email, CustomerPassword, Gender) VALUES (?, ?, ?, ?, ?)', [FirstName, LastName, Email, Password, Gender]);
  
      console.log('User saved to database');
  
      res.redirect('/login.html');
    } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
  