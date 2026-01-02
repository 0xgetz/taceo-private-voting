import { ethers } from 'hardhat';
import * as fs from 'fs';

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);
    console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());
    
    // Deploy Verifier
    console.log('\n📦 Deploying Groth16 Verifier...');
    const Verifier = await ethers.getContractFactory('Groth16Verifier');
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log('✅ Verifier deployed to:', verifierAddress);
    
    // Deploy PrivateVoting
    console.log('\n📦 Deploying PrivateVoting...');
    const candidateCount = 5;
    const votingDuration = 7 * 24 * 60 * 60; // 7 days
    
    const PrivateVoting = await ethers.getContractFactory('PrivateVoting');
    const voting = await PrivateVoting.deploy(
        verifierAddress,
        candidateCount,
        votingDuration
    );
    await voting.waitForDeployment();
    const votingAddress = await voting.getAddress();
    console.log('✅ PrivateVoting deployed to:', votingAddress);
    
    // Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        verifier: verifierAddress,
        voting: votingAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        config: {
            candidateCount,
            votingDuration
        }
    };
    
    fs.writeFileSync(
        'deployment.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('\n📄 Deployment info saved to deployment.json');
    console.log('\n🎉 Deployment complete!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
