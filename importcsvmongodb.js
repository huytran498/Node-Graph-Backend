const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Graph = require('./models/Graph'); // Adjust the path as necessary

async function connectToDatabase() {
    try {
        await mongoose.connect('mongodb://localhost:27017/graphdb', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

async function processCsvFile() {
    return new Promise((resolve, reject) => {
        const csvFilePath = path.join(__dirname, 'graph_properties_results.csv');
        const dataFolderPath = path.join(__dirname, 'data');
        const graphPromises = [];

        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                const graphFileName = row['Filename'];
                const graphFilePath = path.join(dataFolderPath, graphFileName);

                let graphFileContent = null;
                if (fs.existsSync(graphFilePath)) {
                    graphFileContent = fs.readFileSync(graphFilePath);
                }

                const graph = new Graph({
                    fileName: graphFileName,
                    numNodes: parseInt(row['Number of Nodes'], 10),
                    numEdges: parseInt(row['Number of Edges'], 10),
                    maxDegree: parseInt(row['Max Degree'], 10),
                    chromNum: parseInt(row['Chromatic Number'], 10),
                    cliNum: parseInt(row['Clique Number'], 10),
                    vertexCover: parseInt(row['Vertex Cover Size'], 10),
                    isPlanar: row['Is Planar'].toLowerCase() === 'true',
                    graphmlFile: graphFileContent
                });

                graphPromises.push(graph.save().catch((error) => {
                    console.error(`Error saving ${graph.fileName}:`, error);
                }));
            })
            .on('end', async () => {
                try {
                    await Promise.all(graphPromises);
                    console.log('CSV file successfully processed');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

async function main() {
    await connectToDatabase();
    await processCsvFile();
    mongoose.connection.close();
}

main().catch((error) => {
    console.error('An error occurred:', error);
});
