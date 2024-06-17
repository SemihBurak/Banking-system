app.use(express.static("Frontend"));

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});