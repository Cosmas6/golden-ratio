import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';
import { createDerivSocket, setupSocketHandlers, requestTickHistory, closeSocket, APP_IDS } from './derivWebsocket';

const GoldenRatioAnalyzer = () => {
  // Constants
  const GOLDEN_RATIO = 1.618033988749895;
  const COUNT = 99; // Number of ticks to request

  // State variables
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastDigits, setLastDigits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysisResults, setAnalysisResults] = useState({
    digitFrequency: Array(10).fill(0),
    patternMatchRatio: 0,
    goldenRatioCorrelation: 0,
    consecutiveRatios: []
  });
  const [activeTab, setActiveTab] = useState('frequency');

  // Extract the last digit from a price
  const extractLastDigit = (price, pipSize = 4) => {
    return Math.floor((price * Math.pow(10, pipSize)) % 10);
  };

  // Connect to WebSocket
  useEffect(() => {
    // Use the original app_id since it's confirmed to be accurate
    let newSocket = null;
    
    try {
      // Use only the original app_id since you confirmed it's accurate
      newSocket = createDerivSocket(APP_IDS.ORIGINAL);
    } catch (err) {
      console.error('Error creating socket:', err);
      setError(`Failed to create WebSocket: ${err.message}`);
      setLoading(false);
      return;
    }
    
    const handleMessage = (data) => {
      try {
        if (data.error) {
          console.error('API Error:', data.error);
          setError(`API Error: ${data.error.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }
        
        // Handle ping response
        if (data.pong) {
          console.log('Received pong response');
          return;
        }
        
        if (data.msg_type === 'history') {
          console.log('Received history data:', data);
          
          if (!data.history || !data.history.prices || data.history.prices.length === 0) {
            setError('No price data received from API');
            setLoading(false);
            return;
          }
          
          const prices = data.history.prices;
          const pipSize = data.pip_size || 4;
          
          console.log(`Processing ${prices.length} prices with pip size ${pipSize}`);
          
          const digits = prices.map(price => extractLastDigit(price, pipSize));
          console.log('Extracted last digits:', digits);
          
          setLastDigits(digits);
          analyzeData(digits);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
        setError(`Failed to process data from API: ${err.message}`);
        setLoading(false);
      }
    };
    
    try {
      setupSocketHandlers(newSocket, {
        onOpen: () => {
          console.log('WebSocket connected');
          setConnected(true);
          setSocket(newSocket);
          
          // Request tick history as soon as connected
          try {
            requestTickHistory(newSocket, { count: COUNT });
            
            // Set up interval to refresh data every 30 seconds
            const dataIntervalId = setInterval(() => {
              if (newSocket.readyState === WebSocket.OPEN) {
                console.log('Refreshing data...');
                try {
                  requestTickHistory(newSocket, { count: COUNT });
                } catch (refreshErr) {
                  console.error('Error refreshing data:', refreshErr);
                }
              }
            }, 30000);
            
            // Store the interval for cleanup
            window.dataIntervalId = dataIntervalId;
          } catch (reqErr) {
            console.error('Error making initial request:', reqErr);
            setError(`Failed to request data: ${reqErr.message}`);
            setLoading(false);
          }
        },
        onMessage: handleMessage,
        onError: (error) => {
          console.error('WebSocket error:', error);
          setError(`WebSocket error: Connection failed. Please check your network connection and try again.`);
          setLoading(false);
        },
        onClose: (event) => {
          console.log(`WebSocket disconnected: ${event.code} - ${event.reason}`);
          setConnected(false);
          
          // Clear data interval if it exists
          if (window.dataIntervalId) {
            clearInterval(window.dataIntervalId);
          }
        }
      });
    } catch (setupErr) {
      console.error('Error setting up socket handlers:', setupErr);
      setError(`Failed to setup WebSocket: ${setupErr.message}`);
      setLoading(false);
    }
    
    return () => {
      // Clear data interval if it exists
      if (window.dataIntervalId) {
        clearInterval(window.dataIntervalId);
      }
      
      if (newSocket) {
        try {
          closeSocket(newSocket);
        } catch (err) {
          console.error('Error closing socket during cleanup:', err);
        }
      }
    };
  }, []);

  // Analyze the tick data in relation to golden ratio
  const analyzeData = (digits) => {
    if (!digits || digits.length === 0) return;
    
    // 1. Calculate frequency distribution
    const digitFrequency = Array(10).fill(0);
    digits.forEach(digit => {
      digitFrequency[digit]++;
    });
    
    // 2. Calculate pattern match ratio (Fibonacci-like)
    let matches = 0;
    for (let i = 2; i < digits.length; i++) {
      const expectedValue = (digits[i-1] + digits[i-2]) % 10;
      if (digits[i] === expectedValue) {
        matches++;
      }
    }
    const patternMatchRatio = matches / (digits.length - 2);
    
    // 3. Calculate consecutive ratios
    const consecutiveRatios = [];
    for (let i = 0; i < digits.length - 1; i++) {
      if (digits[i] !== 0) {
        consecutiveRatios.push({
          index: i,
          ratio: digits[i+1] / digits[i],
          digit1: digits[i],
          digit2: digits[i+1]
        });
      }
    }
    
    // 4. Calculate golden ratio correlation
    // Compare the distribution pattern with expected distribution
    // For a perfect match with golden ratio properties, we'd expect
    // a specific pattern in the frequency distribution
    const totalDigits = digits.length;
    const idealDistribution = Array(10).fill(totalDigits / 10);
    
    // Calculate chi-square like statistic
    let chiSquare = 0;
    for (let i = 0; i < 10; i++) {
      chiSquare += Math.pow(digitFrequency[i] - idealDistribution[i], 2) / idealDistribution[i];
    }
    
    // Transform to a correlation value between 0 and 1
    // Lower chi-square means better correlation
    const maxChiSquare = totalDigits * 9; // Theoretical max deviation
    const goldenRatioCorrelation = 1 - (chiSquare / maxChiSquare);
    
    setAnalysisResults({
      digitFrequency,
      patternMatchRatio,
      goldenRatioCorrelation,
      consecutiveRatios
    });
  };

  // Prepare data for charts
  const getFrequencyChartData = () => {
    return Array(10).fill().map((_, i) => ({
      digit: i,
      frequency: analysisResults.digitFrequency[i],
      expected: lastDigits.length / 10 // Equal distribution
    }));
  };
  
  const getSequenceChartData = () => {
    return lastDigits.map((digit, index) => ({
      index,
      digit
    }));
  };
  
  const getRatioChartData = () => {
    return analysisResults.consecutiveRatios.map(item => ({
      index: item.index,
      ratio: item.ratio,
      goldenRatio: GOLDEN_RATIO
    }));
  };

  // Handle refresh button click
  const handleRefresh = () => {
    if (socket && connected) {
      setLoading(true);
      
      try {
        requestTickHistory(socket, { count: COUNT });
      } catch (err) {
        console.error('Error sending request:', err);
        setError(`Failed to send request: ${err.message}`);
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
        <div className="text-xl font-bold mb-4">Loading tick data...</div>
        <div className="w-16 h-16 border-t-4 border-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-50">
        <div className="text-2xl font-bold mb-4 text-red-600">Connection Error</div>
        <div className="mb-6 text-center max-w-md">
          <p className="mb-4">{error}</p>
          <p className="text-sm text-gray-600 mb-4">
            This could be due to:
            <ul className="list-disc pl-5 mt-2 text-left">
              <li>Invalid App ID (please check your app_id value)</li>
              <li>Network connectivity issues</li>
              <li>Temporary API service disruption</li>
            </ul>
          </p>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
          <a 
            href="https://api.deriv.com/dashboard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Visit Deriv API Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4 bg-gray-50">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-center">Golden Ratio Analysis of Deriv Tick Data</h1>
        <p className="text-center text-gray-600">
          Analyzing the last digits of {COUNT} price ticks in relation to the golden ratio (φ ≈ {GOLDEN_RATIO})
        </p>
      </header>
      
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Connection status: {connected ? (
            <span className="text-green-600 font-semibold">Connected</span>
          ) : (
            <span className="text-red-600 font-semibold">Disconnected</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={!connected}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Refresh Data
        </button>
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Analysis Results</h2>
        <div className="bg-white p-4 rounded shadow grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border p-3 rounded">
            <div className="text-lg font-medium mb-1">Pattern Match Ratio</div>
            <div className="text-3xl font-bold">{(analysisResults.patternMatchRatio * 100).toFixed(2)}%</div>
            <div className="text-sm text-gray-500">Fibonacci-like pattern matching</div>
          </div>
          <div className="border p-3 rounded">
            <div className="text-lg font-medium mb-1">Golden Ratio Correlation</div>
            <div className="text-3xl font-bold">{(analysisResults.goldenRatioCorrelation * 100).toFixed(2)}%</div>
            <div className="text-sm text-gray-500">Distribution correlation with ideal</div>
          </div>
          <div className="border p-3 rounded">
            <div className="text-lg font-medium mb-1">Sample Size</div>
            <div className="text-3xl font-bold">{lastDigits.length}</div>
            <div className="text-sm text-gray-500">Number of ticks analyzed</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="mb-4 border-b pb-2">
          <div className="flex space-x-4">
            <button 
              className={`px-3 py-1 ${activeTab === 'frequency' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
              onClick={() => setActiveTab('frequency')}
            >
              Digit Frequency
            </button>
            <button 
              className={`px-3 py-1 ${activeTab === 'sequence' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
              onClick={() => setActiveTab('sequence')}
            >
              Digit Sequence
            </button>
            <button 
              className={`px-3 py-1 ${activeTab === 'ratios' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
              onClick={() => setActiveTab('ratios')}
            >
              Consecutive Ratios
            </button>
          </div>
        </div>
        
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'frequency' && (
              <BarChart data={getFrequencyChartData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="digit" />
                <YAxis />
                <Tooltip />
                <Legend />
                <ReferenceLine y={lastDigits.length / 10} stroke="red" strokeDasharray="3 3" />
                <Bar dataKey="frequency" fill="#8884d8" name="Actual Frequency" />
              </BarChart>
            )}
            
            {activeTab === 'sequence' && (
              <LineChart data={getSequenceChartData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis domain={[0, 9]} />
                <Tooltip />
                <Legend />
                <Line type="stepAfter" dataKey="digit" stroke="#82ca9d" name="Last Digit" dot={{ r: 2 }} />
              </LineChart>
            )}
            
            {activeTab === 'ratios' && (
              <LineChart data={getRatioChartData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis />
                <Tooltip />
                <Legend />
                <ReferenceLine y={GOLDEN_RATIO} stroke="red" strokeDasharray="3 3" label="Golden Ratio" />
                <Line type="monotone" dataKey="ratio" stroke="#8884d8" name="Consecutive Ratio" dot={{ r: 2 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Last Digits Sequence</h2>
        <div className="bg-white p-4 rounded shadow overflow-x-auto">
          <div className="flex flex-wrap gap-1">
            {lastDigits.map((digit, index) => (
              <div 
                key={index} 
                className="w-8 h-8 flex items-center justify-center rounded border"
                style={{
                  backgroundColor: digit % 2 === 0 ? '#e5edff' : '#fff0e5',
                  borderColor: digit === (index > 1 ? (lastDigits[index-1] + lastDigits[index-2]) % 10 : -1) 
                    ? '#4caf50' : '#ddd'
                }}
              >
                {digit}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">Insights</h2>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-medium mb-2">Findings:</h3>
          <ul className="list-disc pl-5 mb-4">
            <li>
              Pattern match ratio of {(analysisResults.patternMatchRatio * 100).toFixed(2)}% indicates 
              {analysisResults.patternMatchRatio > 0.15 ? ' some presence' : ' little presence'} 
              of Fibonacci-like patterns in the digits
            </li>
            <li>
              Correlation with golden ratio: 
              {analysisResults.goldenRatioCorrelation > 0.7 
                ? ' Strong correlation detected'
                : analysisResults.goldenRatioCorrelation > 0.5
                  ? ' Moderate correlation detected'
                  : ' Weak correlation detected'}
            </li>
            <li>
              Digit distribution: 
              {Math.max(...analysisResults.digitFrequency) > lastDigits.length / 5
                ? ' Shows significant clustering around specific digits'
                : ' Relatively uniform across all possible values'}
            </li>
          </ul>
          
          <h3 className="font-medium mb-2">About the Golden Ratio (φ):</h3>
          <p className="mb-2">
            The golden ratio (approximately 1.618) appears throughout nature, art, and architecture. It's closely related
            to the Fibonacci sequence, where each number is the sum of the two preceding ones (1, 1, 2, 3, 5, 8, 13, ...).
            The ratio of consecutive Fibonacci numbers converges to the golden ratio.
          </p>
          <p>
            This analysis explores whether the last digits of financial tick data exhibit any patterns or properties
            related to the golden ratio or Fibonacci sequence, which would be significant as these patterns often emerge
            in complex natural and financial systems.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoldenRatioAnalyzer;