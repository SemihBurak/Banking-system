async function getAllCustomers(req, res) {
    try {
      const patients = await pool.query("select * from Customer");
      res.json(patients[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server Error"});
   }
  } 