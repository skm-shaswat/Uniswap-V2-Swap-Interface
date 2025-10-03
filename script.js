const config = {
    uniswapRouterAddress: "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008",
    wethAddress: "0x7b79995e5f793A07Bc00c21412e50Ea00A785cfD", // WETH on Sepolia
    daiAddress: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",  // DAI on Sepolia
    uniswapRouterAbi: [
        "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
    ],
    erc20Abi: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)"
    ]
};

const connectButton = document.getElementById('connect-button');
const swapButton = document.getElementById('swap-button');
const fromAmountInput = document.getElementById('from-amount');
const toAmountInput = document.getElementById('to-amount');
const statusDiv = document.getElementById('status');

let provider, signer, userAddress;

const connectWallet = async () => {
    if (!window.ethereum) {
        statusDiv.innerText = "Please install MetaMask.";
        return;
    }
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        connectButton.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        statusDiv.innerText = "Wallet connected. Ready to swap.";
        swapButton.disabled = false;
    } catch (error) {
        console.error("Failed to connect wallet:", error);
        statusDiv.innerText = "Failed to connect wallet.";
    }
};

const getPrice = async () => {
    if (!fromAmountInput.value || isNaN(fromAmountInput.value) || fromAmountInput.value <= 0) {
        toAmountInput.value = '';
        return;
    }

    const router = new ethers.Contract(config.uniswapRouterAddress, config.uniswapRouterAbi, provider);
    const amountIn = ethers.utils.parseUnits(fromAmountInput.value, 18);
    const path = [config.wethAddress, config.daiAddress];
    
    try {
        const amounts = await router.getAmountsOut(amountIn, path);
        toAmountInput.value = ethers.utils.formatUnits(amounts[1], 18);
    } catch (error) {
        console.error("Failed to get price:", error);
        toAmountInput.value = "Error";
    }
};

const handleSwap = async () => {
    if (!signer) {
        statusDiv.innerText = "Please connect your wallet first.";
        return;
    }
    statusDiv.innerText = "Preparing swap...";
    swapButton.disabled = true;

    const fromToken = new ethers.Contract(config.wethAddress, config.erc20Abi, signer);
    const router = new ethers.Contract(config.uniswapRouterAddress, config.uniswapRouterAbi, signer);
    
    const amountIn = ethers.utils.parseUnits(fromAmountInput.value, 18);
    const amountOutMin = 0; // For simplicity, we don't calculate slippage
    const path = [config.wethAddress, config.daiAddress];
    const to = userAddress;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now

    try {
        statusDiv.innerText = "Checking allowance...";
        const allowance = await fromToken.allowance(userAddress, config.uniswapRouterAddress);

        if (allowance.lt(amountIn)) {
            statusDiv.innerText = "Approval required. Please approve in MetaMask...";
            const approveTx = await fromToken.approve(config.uniswapRouterAddress, amountIn);
            await approveTx.wait();
            statusDiv.innerText = "Approval successful! Proceeding to swap...";
        }

        statusDiv.innerText = "Executing swap. Please confirm in MetaMask...";
        const swapTx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline);
        await swapTx.wait();
        
        statusDiv.innerHTML = `Swap successful! ✅ <a href="https://sepolia.etherscan.io/tx/${swapTx.hash}" target="_blank">View on Etherscan</a>`;
        fromAmountInput.value = '';
        toAmountInput.value = '';

    } catch (error) {
        console.error("Swap failed:", error);
        statusDiv.innerText = `Swap failed: ${error.message}`;
    } finally {
        swapButton.disabled = false;
    }
};

const init = () => {
    swapButton.disabled = true;
    connectButton.addEventListener('click', connectWallet);
    swapButton.addEventListener('click', handleSwap);

    fromAmountInput.addEventListener('input', getPrice);
};

init();
