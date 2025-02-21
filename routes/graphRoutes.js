const express = require('express');
const router = express.Router();
const Graph = require('../models/Graph');
const multer = require('multer');
const archiver = require('archiver');
const { clusterBasedSampling } = require('../utils/clusterSampling');
const { selectRepresentativeSample } = require('../utils/representativeSampling');
const { randomSampling } = require('../utils/randomSampling');

const upload = multer({ storage: multer.memoryStorage() });

// Helper function to build range queries
const getRangeQuery = (filter) => {
    const query = {};
    if (filter.min !== undefined) {
        query.$gte = filter.min;
    }
    if (filter.max !== undefined) {
        query.$lte = filter.max;
    }
    return query;
};

router.get('/', async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    try {
      const count = await Graph.countDocuments();
      const graphs = await Graph.find()
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .exec();
  
      console.log('Total records:', count); // Add this log
  
      res.json({
        graphs,
        totalPages: Math.ceil(count / limit),
        totalRecords: count,
        currentPage: Number(page),
      });
    } catch (error) {
      console.error('Error fetching all graphs:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

// Get filtered data with pagination
// router.post('/filter', async (req, res) => {
//     // const { page = 1, limit = 10, ...filters } = req.body;
//     // const query = {};

//     const { page = 1, limit = 10, ...filters } = req.query;  // Change this line
//     console.log('Received request for page:', page);  // Add this log
//     const query = {};

//     if (filters.fileName) {
//         query.fileName = { $regex: filters.fileName, $options: 'i' };
//     }
//     if (filters.numNodes) {
//         query.numNodes = getRangeQuery(filters.numNodes);
//     }
//     if (filters.numEdges) {
//         query.numEdges = getRangeQuery(filters.numEdges);
//     }
//     if (filters.maxDegree) {
//         query.maxDegree = getRangeQuery(filters.maxDegree);
//     }
//     if (filters.chromNum) {
//         query.chromNum = getRangeQuery(filters.chromNum);
//     }
//     if (filters.cliNum) {
//         query.cliNum = getRangeQuery(filters.cliNum);
//     }
//     if (filters.vertexCover) {
//         query.vertexCover = getRangeQuery(filters.vertexCover);
//     }
//     if (filters.isPlanar !== undefined && filters.isPlanar !== 'both') {
//         query.isPlanar = filters.isPlanar === 'true';
//     }

//     // try {
//     //     const graphs = await Graph.find(query)
//     //         .limit(Number(limit))
//     //         .skip((Number(page) - 1) * Number(limit))
//     //         .exec();

//     //     const count = await Graph.countDocuments(query);
//     //     res.json({
//     //         graphs,
//     //         totalPages: Math.ceil(count / limit),
//     //         totalRecords: count,
//     //         currentPage: Number(page),
//     //     });
//     // } catch (error) {
//     //     console.error('Error fetching filtered graphs:', error.message);
//     //     res.status(500).json({ message: error.message });
//     // }
//     try {
//         const graphs = await Graph.find(query)
//             .limit(Number(limit))
//             .skip((Number(page) - 1) * Number(limit))
//             .exec();

//         const count = await Graph.countDocuments(query);
        
//         console.log('Sending response for page:', page);  // Add this log
//         res.json({
//             graphs,
//             totalPages: Math.ceil(count / limit),
//             totalRecords: count,
//             currentPage: Number(page),  // Ensure this is the requested page
//         });
//     } catch (error) {
//         console.error('Error fetching filtered graphs:', error.message);
//         res.status(500).json({ message: error.message });
//     }
// });

// Add a new graph record

router.post('/filter', async (req, res) => {
    const { filters, page = 1, limit = 10 } = req.body;
    console.log('Received filters:', filters, 'page:', page, 'limit:', limit);
  
    const query = {};
  
    if (filters.fileName) {
      query.fileName = { $regex: filters.fileName, $options: 'i' };
    }
  
    ['numNodes', 'numEdges', 'maxDegree', 'chromNum', 'cliNum', 'vertexCover'].forEach(param => {
      if (filters[param]) {
        query[param] = {};
        if (filters[param].min !== null) {
          query[param][filters[param].operator1 === '<' ? '$lt' : '$gte'] = filters[param].min;
        }
        if (filters[param].max !== null) {
          query[param][filters[param].operator2 === '>' ? '$gt' : '$lte'] = filters[param].max;
        }
      }
    });
  
    if (filters.isPlanar !== undefined && filters.isPlanar !== 'both') {
      query.isPlanar = filters.isPlanar === 'true';
    }
  
    console.log('Constructed query:', query);
  
    try {
      const graphs = await Graph.find(query)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .exec();
  
      const count = await Graph.countDocuments(query);
      
      console.log(`Found ${count} matching documents, returning page ${page}`);
      
      res.json({
        graphs,
        totalPages: Math.ceil(count / limit),
        totalRecords: count,
        currentPage: Number(page),
      });
    } catch (error) {
      console.error('Error fetching filtered graphs:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

router.post('/add', async (req, res) => {
    const {
        fileName,
        numNodes,
        numEdges,
        maxDegree,
        chromNum,
        cliNum,
        vertexCover,
        isPlanar,
        graphImage
    } = req.body;

    const newGraph = new Graph({
        fileName,
        numNodes,
        numEdges,
        maxDegree,
        chromNum,
        cliNum,
        vertexCover,
        isPlanar,
        graphImage
    });

    try {
        const savedGraph = await newGraph.save();
        res.status(201).json(savedGraph);
    } catch (error) {
        console.error('Error adding new graph:', error.message);
        res.status(400).json({ message: error.message });
    }
});

router.post('/download', async (req, res) => {
  try {
    const { filters } = req.body;
    const query = buildQuery(filters);

    const graphs = await Graph.find(query);
    
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', function(err) {
      res.status(500).send({error: err.message});
    });

    // Set the headers
    res.attachment('filtered_graph_files.zip');

    // Pipe archive data to the response
    archive.pipe(res);

    // Add each file to the archive
    for (const graph of graphs) {
      if (graph.graphmlFile) {
        archive.append(graph.graphmlFile, { name: graph.fileName });
      }
    }

    // Finalize the archive (i.e. we are done appending files)
    await archive.finalize();

  } catch (error) {
    console.error('Error downloading graphs:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Helper function to build the query based on filters
function buildQuery(filters) {
  const query = {};

  if (filters.fileName) {
    query.fileName = { $regex: filters.fileName, $options: 'i' };
  }

  ['numNodes', 'numEdges', 'maxDegree', 'chromNum', 'cliNum', 'vertexCover'].forEach(param => {
    if (filters[param]) {
      query[param] = {};
      if (filters[param].min !== null) {
        query[param][filters[param].operator1 === '<' ? '$lt' : '$gte'] = filters[param].min;
      }
      if (filters[param].max !== null) {
        query[param][filters[param].operator2 === '>' ? '$gt' : '$lte'] = filters[param].max;
      }
    }
  });

  if (filters.isPlanar !== undefined && filters.isPlanar !== 'both') {
    query.isPlanar = filters.isPlanar === 'true';
  }

  return query;
}

router.post('/download-sample', async (req, res) => {
  try {
    const { sampleSize = 100, samplingMethod = 'random', filters = {} } = req.body;
    
    // Get filtered graphs
    const query = buildQuery(filters);
    const graphs = await Graph.find(query);
    
    // Select graphs based on sampling method
    let selectedGraphs;
    switch (samplingMethod) {
      case 'representative':
        selectedGraphs = selectRepresentativeSample(graphs, sampleSize);
        break;
      case 'cluster':
        selectedGraphs = clusterBasedSampling(graphs, sampleSize);
        break;
      case 'random':
      default:
        selectedGraphs = randomSampling(graphs, sampleSize);
    }

    // Create zip file
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.attachment('graph_sample.zip');
    archive.pipe(res);

    for (const graph of selectedGraphs) {
      if (graph.graphmlFile) {
        archive.append(graph.graphmlFile, { name: graph.fileName });
      }
    }

    await archive.finalize();

  } catch (error) {
    console.error('Error creating sample download:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
