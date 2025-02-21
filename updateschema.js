const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Graph = require('./models/Graph.js'); // Adjust the path as needed

// Connect to the database
mongoose.connect('mongodb://localhost:27017/graphdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
    addNewField();
}).catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

// Add new field to all documents
async function addNewField() {
    try {
        const dataFolderPath = path.join(__dirname, 'data');
        const graphs = await Graph.find({});

        for (const graph of graphs) {
            const graphFilePath = path.join(dataFolderPath, graph.fileName);

            let graphFileContent = null;
            if (fs.existsSync(graphFilePath)) {
                graphFileContent = fs.readFileSync(graphFilePath);
            }

            await Graph.updateOne(
                { _id: graph._id },
                {
                    $set: {
                        graphImage: '',
                        dateAdded: new Date(),
                        graphmlFile: graphFileContent
                    }
                }
            );
        }

        console.log('New fields added to all documents');
    } catch (error) {
        console.error('Error updating documents:', error);
    } finally {
        mongoose.disconnect();
    }
}
