const mongoose = require('mongoose');

const graphSchema = new mongoose.Schema({
    fileName: String,
    numNodes: Number,
    numEdges: Number,
    maxDegree: Number,
    chromNum: Number,
    cliNum: Number,
    vertexCover: Number,
    isPlanar: Boolean,
    graphImage: String,
    graphmlFile: Buffer // Add this line to store the file content
});

module.exports = mongoose.model('Graph', graphSchema);