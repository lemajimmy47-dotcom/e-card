const combinedMsg = "body: number of localizable_params (3) does not match the expected number of params (6)";
const countMatch = 
  combinedMsg.match(/expected number of params\s*\((\d+)\)/i) || 
  combinedMsg.match(/expected number of params\s*(?:\:\s*)?\(?(\d+)\)?/i) || 
  combinedMsg.match(/expected\s+(\d+)\s+params/i) ||
  combinedMsg.match(/expected\s*(?:\:\s*)?\(?(\d+)\)?/i) ||
  combinedMsg.match(/expected\s+(\d+)/i) ||
  combinedMsg.match(/expected number of params\s+(\d+)/i) ||
  combinedMsg.match(/number of localizable_params\s*\(\d+\)\s*does\s*not\s*match\s*the\s*expected\s*number\s*of\s*params\s*\((\d+)\)/i) ||
  combinedMsg.match(/localizable_params\s*\(\d+\)\s*does\s*not\s*match.*?expected.*?\((\d+)\)/i) ||
  combinedMsg.match(/match\s+the\s+expected\s+number\s+of\s+params\s*\((\d+)\)/i);

console.log(countMatch);
