require("dotenv").config()
const path = require("path")
const AWS = require("aws-sdk")
const multer = require("multer")
const express = require("express")
const app = express()
app.use(express.urlencoded())

AWS.config.update({
    region: process.env.REGION,
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
})

const dynamodb = new AWS.DynamoDB.DocumentClient()
const s3 = new AWS.S3()
const tableName = process.env.DYNAMODB_TABLE
const bucketName = process.env.S3_BUCKET

const storage = multer.memoryStorage({
    destination(req, file, callback) {
        callback(null, "")
    }
})

const upload = multer({
    storage,
    limits: { fileSize: 2000000 },
    fileFilter(req, file, callback) {
        checkFileType(file, callback);
    }
})

function checkFileType(file, callback) {
    const fileTypes = /jpeg|jpg|png|gif/

    const extName = fileTypes.test(path.extname(file.originalname).toLocaleLowerCase())
    const mimetype = fileTypes.test(file.mimetype)
    if (extName && mimetype) {
        return callback(null, true)
    }

    return callback("Error: please choose image type file!")
}


app.get("/", async (req, res) => {
    try {
        const params = { TableName: tableName }
        const data = await dynamodb.scan(params).promise()
        return res.render("index.ejs", { data: data.Items })
    } catch (error) {
        res.status(500).send("Server error!")
    }
})

app.post("/save", upload.single("image"), async (req, res) => {
    try {
        const { maSanPham, tenSanPham, soLuong } = req.body

        const fileType = req.file?.originalname.split(".").pop()
        const filePath = `${maSanPham}_${Date.now().toString()}.${fileType}`

        const params = {
            Bucket: bucketName,
            Key: filePath,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }

        s3.upload(params, async (err, data) => {
            const image = data.Location
            const params = {
                TableName: tableName,
                Item: {
                    maSanPham,
                    tenSanPham,
                    soLuong,
                    image
                }
            }

            await dynamodb.put(params).promise()
            return res.redirect("/")
        })
    } catch (error) {
        return res.status(500).send("Internal server error!")
    }
})

app.post("/delete", upload.fields([]), (req, res) => {
    try {
        const listCheckboxSelected = Object.keys(req.body)

        if (!listCheckboxSelected || listCheckboxSelected.length <= 0)
            return res.redirect("/")

        function onDeleteItem(length) {
            const params = {
                TableName: tableName,
                Key: {
                    maSanPham: listCheckboxSelected[length],
                }
            }
            dynamodb.delete(params, (error, data) => {
                if (error) {
                    console.error(error)
                    return res.send("Server err")
                }
                else if (length > 0)
                    onDeleteItem(length - 1)
                else
                    return res.redirect("/")
            })
        }

        onDeleteItem(listCheckboxSelected.length - 1)
    } catch (error) {
        console.error(error)
    }
})

app.listen(5555, () => {
    console.log("running on port: http://localhost:5555")
})