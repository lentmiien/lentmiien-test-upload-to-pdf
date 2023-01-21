require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const { PDFDocument } = require('pdf-lib');
const { Client } = require('@notionhq/client');

app.set('view engine', 'pug');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: false }));
app.use(fileUpload());

app.get('/', (req, res) => {
  res.render("upload_form");
});

app.post('/generate', async (req, res) => {
  console.log(req.body);
  console.log(req.files);

  // Create PDF file
  const pdfDoc = await PDFDocument.create();

  // Load images to PDF file
  const images = [];
  const keys = Object.keys(req.files);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].indexOf('file') >= 0) {
      if (req.files[keys[i]].name.toLowerCase().indexOf('.jpg') >= 0) {
        images.push(await pdfDoc.embedJpg(req.files[keys[i]].data));
      } else if (req.files[keys[i]].name.toLowerCase().indexOf('.png') >= 0) {
        images.push(await pdfDoc.embedPng(req.files[keys[i]].data));
      }
    }
  }

  // Loop through images and add a page with image for each image
  images.forEach(img => {
    const dims = img.scale(0.15);
    const page = pdfDoc.addPage();

    page.drawImage(img, {
      x: page.getWidth() / 2 - dims.width / 2,
      y: page.getHeight() / 2 - dims.height / 2,
      width: dims.width,
      height: dims.height,
    });
  });

  // Finalize PDF data
  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes.buffer, 'binary');

  // Send pdf to user
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="file.pdf"`);
  res.send(pdfBuffer);
});

/***********
 * Notion
 */
const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;
async function notionTest() {
  // Add entry
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title:[
            {
              "text": {
                "content": "Todo2: stuff"
              }
            }
          ]
        },
        Tags: {
          multi_select: []
        },
        Remarks: {
          rich_text: [
            {
              text: {
                content: "Important remark2"
              }
            }
          ]
        },
        Date: {
          date: {
            start: "2023-01-28"
          }
        },
      },
    });
    console.log(response)
  } catch (error) {
    console.error(error.body)
  }

  // View entries
  try {
    const response = await notion.databases.query({ database_id: databaseId });
    console.log(JSON.stringify(response.results[0].properties, null, 2))
  } catch (error) {
    console.error(error.body)
  }
}
notionTest();

app.listen(3000);