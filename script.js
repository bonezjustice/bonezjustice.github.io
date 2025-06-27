//
// QR Inventory Application Logic (v2 with QR Generator)
// Copyright 2025, Google LLC.
//
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbymR2VX7C2xYjgZX3AgemRAtQdudYfPRx6xu75BcwIVDgNBEaqRUWS5rvNSOMw0iR_ZaQ/exec';

    // --- DOM ELEMENT REFERENCES ---
    const inventoryTableBody = document.querySelector('#inventory-table tbody');
    const addItemBtn = document.getElementById('add-item-btn');
    const generateQrBtn = document.getElementById('generate-qr-btn'); // New button
    const itemModal = document.getElementById('item-modal');
    const qrCodeModal = document.getElementById('qr-code-modal');
    const scannerModal = document.getElementById('scanner-modal');
    const generatorModal = document.getElementById('generator-modal'); // New modal
    const closeModalButtons = document.querySelectorAll('.close-button');
    const itemForm = document.getElementById('item-form');
    const generatorForm = document.getElementById('generator-form'); // New form
    const modalTitle = document.getElementById('modal-title');
    const qrcodeContainer = document.getElementById('qrcode-container');
    const generatedQrContainer = document.getElementById('generated-qrcode-container'); // New container
    const downloadQrLink = document.getElementById('download-qr-link');
    const scanQrBtn = document.getElementById('scan-qr-btn');
    const closeScannerBtn = document.getElementById('close-scanner-btn');
    const loader = document.getElementById('loader');

    let html5QrCode;

    // --- FUNCTIONS ---

    const showLoader = () => {
        loader.style.display = 'block';
        inventoryTableBody.parentElement.style.display = 'none';
    };

    const hideLoader = () => {
        loader.style.display = 'none';
        inventoryTableBody.parentElement.style.display = 'table';
    };

    const getInventory = async () => {
        showLoader();
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getInventory`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();

            if (result.success) {
                populateTable(result.data);
            } else {
                alert(`Error fetching inventory: ${result.message}`);
            }
        } catch (error) {
            alert(`Could not fetch inventory. Check your network connection or Google Script URL.\nError: ${error.message}`);
        } finally {
            hideLoader();
        }
    };

    const populateTable = (items) => {
        inventoryTableBody.innerHTML = '';
        if (items.length === 0) {
            inventoryTableBody.innerHTML = '<tr><td colspan="4">No items in inventory.</td></tr>';
            return;
        }
        items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.ItemName}</td>
                <td>${item.Quantity}</td>
                <td>${item.Location}</td>
                <td>
                    <button class="action-button edit-btn" data-itemid="${item.ItemID}">Edit</button>
                </td>
            `;
            inventoryTableBody.appendChild(row);
        });
    };

    const openNewItemModal = () => {
        itemForm.reset();
        document.getElementById('ItemID').value = '';
        modalTitle.textContent = 'Add New Item';
        itemModal.style.display = 'block';
    };

    const openEditItemModal = async (itemId) => {
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getItemById&itemId=${itemId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();

            if (result.success) {
                const item = result.data;
                document.getElementById('ItemID').value = item.ItemID;
                document.getElementById('ItemName').value = item.ItemName;
                document.getElementById('Description').value = item.Description;
                document.getElementById('Quantity').value = item.Quantity;
                document.getElementById('Location').value = item.Location;
                modalTitle.textContent = 'Edit Item';
                itemModal.style.display = 'block';
            } else {
                alert(`Error finding item: ${result.message}`);
            }
        } catch (error) {
            alert(`Network or script error: ${error.message}`);
        }
    };

    const closeModal = () => {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.style.display = 'none');
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error("Failed to stop scanner:", err));
        }
    };
    
    // **UPDATED FUNCTION**
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(itemForm);
        const data = Object.fromEntries(formData.entries());
        const isNewItem = !data.ItemID;

        const submitButton = document.getElementById('save-item-btn');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json(); // Now we can read the response!

            if (result.success) {
                closeModal();
                if (isNewItem && result.newItemId) {
                    // If it was a new item, show the generated QR code
                    showQrCodeForNewItem(result.newItemId);
                } else {
                    alert('Item updated successfully!');
                }
                getInventory(); // Refresh the list
            } else {
                alert(`Error saving item: ${result.message}`);
            }

        } catch (error) {
            alert(`Error saving item: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Item';
        }
    };
    
    // Renamed this function for clarity
    const showQrCodeForNewItem = (text) => {
        qrcodeContainer.innerHTML = ''; // Clear previous QR code
        new QRCode(qrcodeContainer, {
            text: text,
            width: 200,
            height: 200,
        });

        setTimeout(() => {
            const qrImg = qrcodeContainer.querySelector('img');
            if (qrImg) {
                downloadQrLink.href = qrImg.src;
            }
        }, 100);

        qrCodeModal.style.display = 'block';
    };

    const startScanner = () => {
        scannerModal.style.display = 'block';
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        const onScanSuccess = (decodedText, decodedResult) => {
            closeModal();
            // Check if the scanned code is an ItemID before trying to open it
            if (decodedText.startsWith('ITEM-')) {
                 openEditItemModal(decodedText);
            } else {
                alert(`Scanned Text: ${decodedText}`);
            }
        };

        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
            .catch(err => {
                alert("Could not start scanner. Make sure you grant camera permissions.");
                console.error("Scanner error:", err);
            });
    };

    // --- NEW FUNCTIONS FOR QR GENERATOR ---
    const openGeneratorModal = () => {
        generatorForm.reset();
        generatedQrContainer.innerHTML = ''; // Clear old QR code
        generatorModal.style.display = 'block';
    };

    const handleGeneratorSubmit = (e) => {
        e.preventDefault();
        const textToEncode = document.getElementById('text-to-encode').value;
        if (!textToEncode) {
            alert('Please enter text or an ID to generate a QR code.');
            return;
        }
        generatedQrContainer.innerHTML = '';
        new QRCode(generatedQrContainer, {
            text: textToEncode,
            width: 220,
            height: 220,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    };

    // --- EVENT LISTENERS ---
    addItemBtn.addEventListener('click', openNewItemModal);
    scanQrBtn.addEventListener('click', startScanner);
    generateQrBtn.addEventListener('click', openGeneratorModal); // New listener
    itemForm.addEventListener('submit', handleFormSubmit);
    generatorForm.addEventListener('submit', handleGeneratorSubmit); // New listener

    closeModalButtons.forEach(button => button.addEventListener('click', closeModal));
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            closeModal();
        }
    });

    inventoryTableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('edit-btn')) {
            const itemId = event.target.dataset.itemid;
            openEditItemModal(itemId);
        }
    });
    
    closeScannerBtn.addEventListener('click', closeModal);

    // --- INITIALIZATION ---
    if (GOOGLE_SCRIPT_URL === 'PASTE_YOUR_WEB_APP_URL_HERE') {
        alert('CRITICAL: Please open the script.js file and paste your Google Web App URL.');
        return;
    }
    getInventory();
});
