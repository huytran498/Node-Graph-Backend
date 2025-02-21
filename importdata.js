const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Graph = require('./models/Graph');

// Function to read .graphml file
function readGraphMLFile(filename) {
  const graphmlPath = `./test/${filename}`; // Adjust this path as needed
  try {
    return fs.readFileSync(graphmlPath);
  } catch (error) {
    console.error(`Error reading file ${filename}:`, error);
    return null;
  }
}

// Function to process CSV data and import to MongoDB
async function importData() {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream('graph_properties_results.csv')
      .pipe(csv())
      .on('data', (row) => results.push(row))
      .on('end', async () => {
        for (const row of results) {
          try {
            const graphmlContent = readGraphMLFile(row.Filename);
            
            if (!graphmlContent) {
              console.warn(`Skipping ${row.Filename} due to missing .graphml file`);
              continue;
            }

            const graph = new Graph({
              fileName: row.Filename,
              numNodes: parseInt(row['Number of Nodes']),
              numEdges: parseInt(row['Number of Edges']),
              maxDegree: parseInt(row['Max Degree']),
              chromNum: parseInt(row['Chromatic Number']),
              cliNum: parseInt(row['Clique Number']),
              vertexCover: parseInt(row['Vertex Cover Size']),
              isPlanar: row['Is Planar'] === 'True',
              graphmlFile: graphmlContent
            });

            await graph.save();
            console.log(`Imported: ${row.Filename}`);
          } catch (error) {
            console.error(`Error importing ${row.Filename}:`, error);
          }
        }
        resolve();
      })
      .on('error', reject);
  });
}

// Main function to run the import process
async function main() {
  try {
    await mongoose.connect('mongodb://localhost:27017/graphdb', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    await importData();
    console.log('CSV file successfully processed');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the main function
main();