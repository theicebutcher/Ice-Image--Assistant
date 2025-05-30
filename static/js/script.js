let savedImages = []; // Initialize as an empty array
let modal = document.getElementById("imageModal");
let canvas = document.getElementById("drawingCanvas");
let ctx = canvas.getContext("2d");
let currentImageURL = null;
let isPainting = false;
let lineWidth = 10;
let startX, startY;


// Initialize canvas with proper dimensions
function resizeCanvas() {
    const container = modal.querySelector('.modal-content');
    // Reduce the subtracted values to make canvas larger
    canvas.width = container.offsetWidth - 20;  // Was -40
    canvas.height = container.offsetHeight - 80;  // Was -150

    if (currentImageURL) {
        redrawImage();
    }
}
// Redraw image onto canvas
// Redraw image onto canvas
function redrawImage() {
    if (currentImageURL) {
        let img = new Image();
        img.onload = function () {
            // Set canvas dimensions to match the image
            canvas.width = img.width;
            canvas.height = img.height;

            // Clear and redraw the image at full size
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, img.width, img.height);

            // Optional: Adjust modal size to fit the canvas
            adjustModalToCanvas();
        };
        img.src = currentImageURL;
    }
}

// Optional: Resize modal to fit the canvas (or enable scrolling)
function adjustModalToCanvas() {
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.width = 'auto';
    modalContent.style.height = 'auto';
    modalContent.style.overflow = 'auto'; // Enable scrolling if needed
}
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;    // relationship bitmap vs. element for X
    const scaleY = canvas.height / rect.height;  // relationship bitmap vs. element for Y

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function startPosition(e) {
    isPainting = true;
    const pos = getCanvasCoordinates(e);
    startX = pos.x;
    startY = pos.y;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
}

function draw(e) {
    if (!isPainting) return;

    const pos = getCanvasCoordinates(e);

    // Save the current context state
    ctx.save();

    // Apply current styles
    ctx.strokeStyle = document.getElementById('stroke').value; // Get current color
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Restore the context state (optional)
    ctx.restore();
}
function endPosition() {
    isPainting = false;
    ctx.beginPath();
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentImageURL) {
        redrawImage();
    }
}
document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();  // Optional: prevents form submission if inside a form
        sendMessage();           // Trigger sendMessage() on Enter key press
    }
});
function updateInputFiles() {
    const imageUpload = document.getElementById("image-upload");
    const dataTransfer = new DataTransfer();

    // Add all files from our global array to the DataTransfer
    selectedFiles.forEach(file => {
        dataTransfer.items.add(file);
    });

    // Update the input's files
    imageUpload.files = dataTransfer.files;
}
let selectedFiles = [];

function previewImage() {
    const imageUpload = document.getElementById("image-upload");
    const previewContainer = document.getElementById("image-preview-container");

    // Add newly selected files to our global array, avoiding duplicates
    if (imageUpload.files && imageUpload.files.length > 0) {
        Array.from(imageUpload.files).forEach(file => {
            // Check if file already exists in our array
            const fileExists = selectedFiles.some(
                existingFile => existingFile.name === file.name &&
                    existingFile.size === file.size &&
                    existingFile.lastModified === file.lastModified
            );

            if (!fileExists) {
                selectedFiles.push(file);
            }
        });
    }

    // Clear and rebuild preview with all selected files
    previewContainer.innerHTML = "";

    selectedFiles.forEach((file, index) => {
        const imgPreview = document.createElement("img");
        imgPreview.classList.add("preview-image");

        const reader = new FileReader();
        reader.onload = function (e) {
            imgPreview.src = e.target.result;
            imgPreview.style.cursor = "pointer";
            imgPreview.title = "Click to remove image";

            // Use a closure to capture the correct index
            imgPreview.onclick = (function (idx) {
                return function () {
                    removeImage(idx);
                };
            })(index);
        };
        reader.readAsDataURL(file);

        previewContainer.appendChild(imgPreview);
    });

    // Update the actual input's files (for form submission)
    updateInputFiles();
}
function removeImage(index) {
    // Remove the file from our global array
    selectedFiles.splice(index, 1);

    // Update the input files to reflect the change
    updateInputFiles();

    // Rebuild preview with remaining images
    previewImage();
}

function toggleChatbot() {
    var chatbot = document.getElementById("chatbot-container");
    var button = document.getElementById("chatbot-button");

    if (chatbot.style.display === "none" || !chatbot.style.display) {
        chatbot.style.display = "flex";
        button.style.display = "none";
    } else {
        chatbot.style.display = "none";
        button.style.display = "none";
        button.style.display = "flex";
    }
}

function formatResponse(rawResponse) {
    // Precise Image URL detection (Cloudinary and common formats)
    const imageRegex = /!\[(.*?)\]\((https?:\/\/(?:res\.cloudinary\.com|[a-zA-Z0-9.-]+)\S*?\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?)\)/gi;

    // Convert Markdown image syntax ![alt text](URL) to an <img> tag
    rawResponse = rawResponse.replace(imageRegex, (match, altText, imageUrl) => {
        return `<div style="text-align: center; margin-top: 20px;">
        <img src="${imageUrl}" alt="${altText}" style="max-width: 100%; height: auto; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); transition: transform 0.3s ease, box-shadow 0.3s ease;">
    </div>`;
    });

    // Bold text: **text**
    rawResponse = rawResponse.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic text: *text* (only if NOT part of an image)
    rawResponse = rawResponse.replace(/(?<!\!)\*(.*?)\*/g, '<em>$1</em>');

    // Italicize text inside square brackets: [text] → <em>text</em>
    rawResponse = rawResponse.replace(/\[(.*?)\]/g, '<em>$1</em>');

    // Headers: # text, ## text, etc.
    rawResponse = rawResponse.replace(/^(#{1,6})\s*(.*?)$/gm, (match, hashes, headerText) => {
        const level = hashes.length;
        return `<h${level}>${headerText}</h${level}>`;
    });

    // Code blocks: ```code```
    rawResponse = rawResponse.replace(/```(.*?)```/gs, '<pre>$1</pre>');

    // Inline code: `code`
    rawResponse = rawResponse.replace(/`(.*?)`/g, '<code>$1</code>');

    // Convert other URLs to clickable links (excluding images)
    rawResponse = rawResponse.replace(/(https?:\/\/[^\s<>")]+)/g, (match) => {
        if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(match)) {
            return `<a href="${match}" target="_blank">${match}</a>`;
        }
        return match;
    });

    return rawResponse;
}

// Function to simulate saving images to a "selected images" folder (client-side only)
function saveImagesLocally(files) {
    return new Promise((resolve, reject) => {
        const savedFiles = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Simulating saving: just creating a temporary URL for demonstration
            const blob = new Blob([file], { type: file.type });
            const url = URL.createObjectURL(blob);
            savedFiles.push({ name: file.name, url }); // Store name and temp URL
        }
        resolve(savedFiles);
    });
}

// Function to delete "saved" images (revoke temporary URLs)
function deleteSavedImages(savedImages) {
    savedImages.forEach(image => {
        URL.revokeObjectURL(image.url);
    });
}
function clearSelectedFiles() {
    console.log("Clearing selected files...");
    console.log("Before clear - selectedFiles:", selectedFiles.length);

    selectedFiles = [];
    document.getElementById("image-upload").value = "";
    document.getElementById("image-preview-container").innerHTML = "";

    console.log("After clear - selectedFiles:", selectedFiles.length);
}
async function sendMessage() {
    var userInput = document.getElementById("user-input").value;
    var imageUpload = document.getElementById("image-upload");
    var chatMessages = document.getElementById("chat-messages");

    // Check for empty user input and images
    if (selectedFiles.length > 0) {
        console.log("Adding images to FormData...");
        try {
            savedImages = await saveImagesLocally(selectedFiles);
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                formData.append("images", file);
                console.log("Appended image:", file.name);
            }
        } catch (error) {
            console.error("Error saving images:", error);
        }
    }

    // Display user's message
    var userMessageDiv = document.createElement("div");
    userMessageDiv.classList.add("message", "user-message");

    var userIcon = document.createElement("span");
    userIcon.classList.add("icon");

    var userImg = document.createElement("img");
    userImg.src = "static/user.png"; // Replace with your actual image path or URL
    userImg.alt = "User Icon";
    userImg.style.width = "24px";
    userImg.style.height = "24px";

    userIcon.appendChild(userImg);

    var userMessageText = document.createElement("div");
    userMessageText.classList.add("message-text");
    userMessageText.textContent = userInput;

    userMessageDiv.appendChild(userIcon);
    userMessageDiv.appendChild(userMessageText);

    // Display uploaded images (if any)
    if (imageUpload.files && imageUpload.files.length > 0) {
        const previewContainer = document.createElement("div");  // Create a container for previews
        previewContainer.style.display = "flex";
        previewContainer.style.flexWrap = "wrap"; // Allows images to wrap
        previewContainer.style.gap = "5px"; // Add some spacing between images

        for (let i = 0; i < imageUpload.files.length; i++) {
            const file = imageUpload.files[i];
            var userImage = document.createElement("img");
            userImage.classList.add("chat-image");
            userImage.style.maxWidth = "50px"; // Make it a small preview
            userImage.style.maxHeight = "50px";
            userImage.style.objectFit = "cover";

            var reader = new FileReader();
            reader.onload = (function (img) {
                return function (e) {
                    img.src = e.target.result;
                };
            })(userImage);

            reader.readAsDataURL(file);
            previewContainer.appendChild(userImage); // Append to the container
        }
        userMessageDiv.appendChild(previewContainer); // Append the container to the message
    }

    chatMessages.appendChild(userMessageDiv);

    // Clear the image preview after sending
    //document.getElementById("image-preview-container").innerHTML = ""; //THIS SHOULD BE HERE, NOT IN FINALLY
    //document.getElementById("image-upload").value = ""; //Commented to check if this resolves the issue

    // Display bot message with loader
    var botMessageDiv = document.createElement("div");
    botMessageDiv.classList.add("message", "bot-message");

    var botIcon = document.createElement("span");
    botIcon.classList.add("icon");

    var botImg = document.createElement("img");
    botImg.src = "static/user.png";
    botImg.alt = "Bot Icon";
    botImg.style.width = "24px";
    botImg.style.height = "24px";

    botIcon.appendChild(botImg);

    var botMessageText = document.createElement("div");
    botMessageText.classList.add("message-text");

    var spiralLoader = document.createElement("div");
    spiralLoader.classList.add("spiral-loader");

    botMessageText.appendChild(spiralLoader);
    botMessageDiv.appendChild(botIcon);
    botMessageDiv.appendChild(botMessageText);
    chatMessages.appendChild(botMessageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    var formData = new FormData();
    formData.append("user_input", userInput);

    let savedImages = [];

    // Create a new DataTransfer object outside the if block
    const dataTransfer = new DataTransfer();

    // If there are already images in the input, add them to the DataTransfer
    if (imageUpload.files && imageUpload.files.length > 0) {
        for (let i = 0; i < imageUpload.files.length; i++) {
            dataTransfer.items.add(imageUpload.files[i]);
        }
    }

    // Append multiple images
    if (imageUpload.files && imageUpload.files.length > 0) {
        console.log("Adding images to FormData...");  // ADDED LOGGING
        const filesArray = Array.from(imageUpload.files);


        try {
            savedImages = await saveImagesLocally(filesArray); // "Save" images
            for (let i = 0; i < filesArray.length; i++) {
                const file = filesArray[i];
                formData.append("images", file); // Use "images" as the key
                // dataTransfer.items.add(file); NO LONGER NEEDED
                console.log("Appended image:", file.name); // ADDED LOGGING
            }
            console.log("FormData after adding images:", formData); // ADDED LOGGING



        } catch (error) {
            console.error("Error saving images:", error);
            // Handle the error appropriately (e.g., show an error message)
        }


    } else {
        console.log("No images to add to FormData.");  // ADDED LOGGING
    }

 fetch("/chatbot", {
    method: "POST",
    body: formData
})
    .then(response => response.json())
    .then(data => {
        // Remove loader
        botMessageText.removeChild(spiralLoader);

        if (data.response.includes("https://theicebutcher.com/request/")) {
            // Handle order link case
            botMessageText.innerHTML = "";
            var link = document.createElement("a");
            link.href = "https://theicebutcher.com/request/";
            link.target = "_blank";

            var img = document.createElement("img");
            img.src = "/static/img.PNG";
            img.classList.add("chat-image");
            img.style.maxWidth = "200px";
            img.style.borderRadius = "12px";
            img.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
            img.style.transition = "transform 0.2s ease-in-out";

            link.appendChild(img);
            botMessageText.appendChild(link);
        } else {
            // Show regular text response
            const formattedResponse = formatResponse(data.response);
            botMessageText.innerHTML = formattedResponse || "Sorry, I couldn't understand your request.";
        }

        // Display reference images if present
        if (data.reference_images && data.reference_images.length > 0) {
            const imageContainer = document.createElement("div");
            imageContainer.style.display = "flex";
            imageContainer.style.flexWrap = "wrap";
            imageContainer.style.gap = "10px";
            imageContainer.style.marginTop = "10px";

            data.reference_images.forEach(imageUrl => {
                const refImage = document.createElement("img");
                refImage.src = imageUrl;
                refImage.classList.add("chat-image");
                refImage.style.maxWidth = "150px"; // Adjust size as needed
                refImage.style.cursor = "pointer";

                // Add click event to select the reference image for generation
                refImage.onclick = function () {
                    // Update user input to indicate selection and trigger generation
                    document.getElementById("user-input").value = `Generate a Double Luge sculpture based on this reference image: ${imageUrl}`;
                    sendMessage();
                };

                imageContainer.appendChild(refImage);
            });

            botMessageText.appendChild(imageContainer);
        }

        // Handle base64 image response from GPT Image Generation (rest of the existing logic remains unchanged)
        if (data.image_url) {
            savedImages.push(data.image_url);
            const timestamp = new Date().getTime();
            const randomNum = Math.floor(Math.random() * 1000);
            const uniqueFilename = `generated_image_${timestamp}_${randomNum}.png`;

            var img = document.createElement("img");
            img.src = data.image_url;
            img.classList.add("chat-image");
            img.alt = `Generated Image ${timestamp}`;

            img.onclick = function () {
                openModal(data.image_url);  // Open modal for editing
            };

            // Create button container
            const buttonContainer = document.createElement("div");
            buttonContainer.style.display = "flex";
            buttonContainer.style.gap = "10px";
            buttonContainer.style.justifyContent = "center";
            buttonContainer.style.marginTop = "10px";

            // Create download button
            const downloadBtn = document.createElement("button");
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
            downloadBtn.style.padding = "8px 16px";
            downloadBtn.style.borderRadius = "4px";
            downloadBtn.style.backgroundColor = "#6082a6";
            downloadBtn.style.color = "white";
            downloadBtn.style.border = "none";
            downloadBtn.style.cursor = "pointer";
            downloadBtn.style.display = "flex";
            downloadBtn.style.alignItems = "center";
            downloadBtn.style.gap = "5px";

            downloadBtn.onclick = function () {
                const link = document.createElement("a");
                link.href = data.image_url;
                link.download = uniqueFilename;
                link.click();
            };
            img.onclick = function () {
                openModal(data.image_url);  // Open the modal on click
            };

            // Create select button
            const selectBtn = document.createElement("button");
            selectBtn.innerHTML = '<i class="fas fa-check-circle"></i> Select';
            selectBtn.style.padding = "8px 16px";
            selectBtn.style.borderRadius = "4px";
            selectBtn.style.backgroundColor = "#4CAF50";
            selectBtn.style.color = "white";
            selectBtn.style.border = "none";
            selectBtn.style.cursor = "pointer";
            selectBtn.style.display = "flex";
            selectBtn.style.alignItems = "center";
            selectBtn.style.gap = "5px";

            selectBtn.onclick = function () {
                fetch(data.image_url)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], uniqueFilename, { type: "image/png" });
                        selectedFiles = [file]; // Replace with new image for editing
                        updateInputFiles();
                        previewImage();
                        // document.getElementById("user-input").value = "Edit this image: " + userInput;
                        document.getElementById("user-input").focus();
                    });
            };
            // Add buttons to container
            buttonContainer.appendChild(downloadBtn);
            buttonContainer.appendChild(selectBtn);

            // Create image container
            const imageContainer = document.createElement("div");
            imageContainer.style.textAlign = "center";
            imageContainer.appendChild(img);
            imageContainer.appendChild(buttonContainer);

            botMessageText.appendChild(imageContainer);

            // Add feedback modal trigger
            openInlineFeedback(data.image_url);
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    })
        .catch(error => {
            console.error("Error:", error);
            botMessageText.removeChild(spiralLoader);
            botMessageText.textContent = "Sorry, there was an error processing your request.";
        })
        .finally(() => {
            // Delete saved images after sending
            if (savedImages.length > 0) {
                deleteSavedImages(savedImages);
                console.log("Saved images deleted.");
            }

            // Clear all file selections and previews
            clearSelectedFiles();

            // Clear the text input
            document.getElementById("user-input").value = "";

            const form = document.querySelector('form'); // if you have a form
            if (form) form.reset();
        });


}

// Event listeners for drawing
canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mouseout', endPosition);

// Toolbar event listeners
document.getElementById('stroke').addEventListener('change', (e) => {
    ctx.strokeStyle = e.target.value;
});

document.getElementById('lineWidth').addEventListener('change', (e) => {
    lineWidth = e.target.value;
});

document.getElementById('clearDrawingBtn').addEventListener('click', clearCanvas);

// Window resize handler
window.addEventListener('resize', () => {
    if (modal.style.display === 'block') {
        resizeCanvas();
    }
});

// Update the openModal function
function openModal(imageURL) {
    modal.style.display = "block";
    currentImageURL = imageURL;

    setTimeout(() => {
        resizeCanvas();

        // Set initial drawing styles using the input's value
        ctx.strokeStyle = document.getElementById('stroke').value; // Use input's value
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, 10);
}

function closeModal() {
    modal.style.display = "none";
    currentImageURL = null;
    clearCanvas();  // Clear the canvas when closing
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentImageURL) {
        let img = new Image();
        img.onload = function () {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = currentImageURL;
    }

}

function confirmDrawing() {
    // Convert the canvas content to a data URL (image)
    const drawnImage = canvas.toDataURL("image/png");

    // You now have the drawn image as a base64 string (`drawnImage`)
    // You can send this back to your server or perform other actions
    console.log("Drawn Image Data:", drawnImage);

    // Here, simulate adding the drawn image to the existing images
    // Convert data URL to blob
    fetch(drawnImage)
        .then(res => res.blob())
        .then(blob => {
            // Create a File object
            const newFile = new File([blob], 'drawn_image.png', { type: 'image/png' });

            // Add the new file to the selectedFiles array
            selectedFiles.push(newFile);

            // Update the input files
            updateInputFiles();

            // Rebuild the preview to include the new image
            previewImage();
        });
    //close the modal
    closeModal();
}
function updateInputFiles() {
    const imageUpload = document.getElementById("image-upload");
    const dataTransfer = new DataTransfer();

    // Add all files from our global array to the DataTransfer
    selectedFiles.forEach(file => {
        dataTransfer.items.add(file);
    });

    // Update the input's files
    imageUpload.files = dataTransfer.files;
}
function removeImage(index) {
    // Remove the file from our global array
    selectedFiles.splice(index, 1);

    // Update the input files to reflect the change
    updateInputFiles();

    // Rebuild preview with remaining images
    previewImage();
}
function clearSelectedFiles() {
    console.log("Starting clear...");
    console.log("selectedFiles before:", selectedFiles.length);

    selectedFiles = [];

    const imageUpload = document.getElementById("image-upload");
    console.log("input value before:", imageUpload.value);
    imageUpload.value = "";

    console.log("Clearing preview...");
    document.getElementById("image-preview-container").innerHTML = "";

    if (imageUpload.files) {
        console.log("Clearing DataTransfer...");
        const dataTransfer = new DataTransfer();
        imageUpload.files = dataTransfer.files;
    }

    console.log("Clear complete");
    console.log("selectedFiles after:", selectedFiles.length);
    console.log("input value after:", imageUpload.value);
}
let recognition;
let isListening = false;

function startVoiceInput() {
    const micBtn = document.getElementById("mic-btn");

    if (!recognition) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false; // Stop after one sentence
        recognition.interimResults = false; // Only final results
        recognition.lang = "en-US"; // Set language

        recognition.onstart = function () {
            isListening = true;
            micBtn.classList.add("active");
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById("user-input").value = transcript;
            isListening = false;
            micBtn.classList.remove("active");

            // Automatically send the message
            sendMessage();
        };

        recognition.onerror = function (event) {
            console.error("Speech recognition error:", event.error);
            isListening = false;
            micBtn.classList.remove("active");
        };

        recognition.onend = function () {
            isListening = false;
            micBtn.classList.remove("active");
        };
    }

    if (isListening) {
        recognition.stop();
        isListening = false;
        micBtn.classList.remove("active");
    } else {
        recognition.start();
    }
}



// Add these functions to your existing script.js or in a script tag within the HTML
function startSculptureFlow() {
    // Hide the initial prompt button
    let startPromptButton = document.getElementById('start-prompt-button');
    if (startPromptButton) {
        startPromptButton.style.display = 'none';
    }

    // Display sculpture type selection buttons
    displaySculptureTypeButtons();
}

function displaySculptureTypeButtons() {
    const chatMessages = document.getElementById('chat-messages');
    // Create a container for the buttons
    // Clear any existing button container
    const existingContainer = document.getElementById('sculpture-buttons-container');
    if (existingContainer) {
        chatMessages.removeChild(existingContainer);
    }

    // Create a container for the buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'sculpture-buttons-container';
    buttonContainer.style.position = 'sticky';
    buttonContainer.style.bottom = '0';
    buttonContainer.style.backgroundColor = '#fff';
    buttonContainer.style.padding = '10px';
    buttonContainer.style.borderTop = '1px solid #eee';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexWrap = 'wrap';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.zIndex = '100';

    // Define the sculpture types
    const sculptureTypes = [
        { label: 'Luge', value: 'luge' },
        { label: 'Seafood Display', value: 'seafood_display' },
        { label: 'Showpieces', value: 'showpieces' },
        { label: 'Ice Bar', value: 'ice_bar' },
        { label: 'Ice Cubes', value: 'ice_cubes' }
    ];

    // Create and append the buttons
    sculptureTypes.forEach(type => {
        const button = document.createElement('button');
        button.textContent = type.label;
        button.onclick = () => handleSculptureTypeSelection(type.value);
        buttonContainer.appendChild(button);
    });

    // Add back button
    const backButton = createBackButton("<");
    backButton.onclick = () => resetSculptureButtons();
    buttonContainer.appendChild(backButton);

    // Append the button container to the chat messages
    chatMessages.appendChild(buttonContainer);
}


function handleSculptureTypeSelection(type) {
    // Clear existing buttons
    const chatMessages = document.getElementById('chat-messages');
    const buttonContainer = document.getElementById('sculpture-buttons-container');
    if (buttonContainer) {
        chatMessages.removeChild(buttonContainer);
    }

    // Save the sculpture type
    currentSculptureType = type;

    // For luge, show luge types first
    if (type === 'luge') {
        displayLugeTypeButtons();
    } else {
        // For other types, show themes directly
        displayThemeButtons();
    }
}


let currentSculptureType = null;
let currentLugeType = null;
function displayThemeButtons() {
    const chatMessages = document.getElementById('chat-messages');

    // Clear existing container
    const existingContainer = document.getElementById('sculpture-buttons-container');
    if (existingContainer) {
        chatMessages.removeChild(existingContainer);
    }

    // Create new container with bottom styling
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'sculpture-buttons-container';
    buttonContainer.style.position = 'sticky';
    buttonContainer.style.bottom = '0';
    buttonContainer.style.backgroundColor = '#fff';
    buttonContainer.style.padding = '10px';
    buttonContainer.style.borderTop = '1px solid #eee';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexWrap = 'wrap';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.zIndex = '100';

    // Define the themes
    const themes = ['Dragon', 'Bunny', 'Birthday', 'Holiday', 'Country Club', 'No Theme'];

    // Create and append the buttons
    themes.forEach(theme => {
        const button = document.createElement('button');
        button.textContent = theme;
        button.onclick = () => {
            let prompt;

            if (currentSculptureType === 'luge') {
                // For luge, use the stored luge type
                prompt = `I want a ${currentLugeType.replace('_', ' ')}`;
                if (theme !== 'No Theme') {
                    prompt += ` for ${theme} theme`;
                }
                prompt += `.`;
            } else {
                // For other sculpture types
                prompt = `I want a`;
                if (theme !== 'No Theme') {
                    prompt += ` ${theme} themed`;
                }
                prompt += ` ${currentSculptureType.replace('_', ' ')} sculpture.`;
            }

            sendPredefinedPrompt(prompt);
        };
        buttonContainer.appendChild(button);
    });

    // Add back button
    const backButton = createBackButton("<");
    backButton.onclick = () => {
        if (currentSculptureType === 'luge') {
            displayLugeTypeButtons(); // Go back to luge type selection
        } else {
            displaySculptureTypeButtons(); // Go back to sculpture type selection
        }
    };
    buttonContainer.appendChild(backButton);

    // Append the button container to the chat messages
    chatMessages.appendChild(buttonContainer);
}

function displayLugeTypeButtons() {
    const chatMessages = document.getElementById('chat-messages');

    // Clear existing buttons
    const buttonContainer = document.getElementById('sculpture-buttons-container');
    if (buttonContainer) {
        chatMessages.removeChild(buttonContainer);
    }

    // Create a container for the luge type buttons
    const lugeButtonContainer = document.createElement('div');
    lugeButtonContainer.id = 'sculpture-buttons-container';
    lugeButtonContainer.style.position = 'sticky';
    lugeButtonContainer.style.bottom = '0';
    lugeButtonContainer.style.backgroundColor = '#fff';
    lugeButtonContainer.style.padding = '10px';
    lugeButtonContainer.style.borderTop = '1px solid #eee';
    lugeButtonContainer.style.display = 'flex';
    lugeButtonContainer.style.flexWrap = 'wrap';
    lugeButtonContainer.style.gap = '8px';
    lugeButtonContainer.style.zIndex = '100';

    // Define the luge types
    const lugeTypes = [
        { label: 'Martini Luge', value: 'martini_luge' },
        { label: 'Double Luge', value: 'double_luge' },
        { label: 'Tube Luge', value: 'tube_luge' }
    ];

    // Create and append the luge type buttons
    lugeTypes.forEach(type => {
        const button = document.createElement('button');
        button.textContent = type.label;
        button.onclick = () => {
            currentLugeType = type.value; // Store selected luge type
            displayThemeButtons(); // Then show theme options
        };
        lugeButtonContainer.appendChild(button);
    });

    // Add back button
    const backButton = createBackButton("<");
    backButton.onclick = () => {
        displaySculptureTypeButtons(); // Go back to sculpture type selection
    };
    lugeButtonContainer.appendChild(backButton);

    // Append the luge type button container to the chat messages
    chatMessages.appendChild(lugeButtonContainer);
}

function sendPredefinedPrompt(prompt) {
    // Send the predefined prompt to the chat
    document.getElementById('user-input').value = prompt;
    sendMessage();
}

function resetSculptureButtons() {
    const chatMessages = document.getElementById('chat-messages');

    // Find and remove the button container, if it exists
    const buttonContainer = document.getElementById('sculpture-buttons-container');
    if (buttonContainer) {
        chatMessages.removeChild(buttonContainer);
    }

    // Find the start prompt button
    let startPromptButton = document.getElementById('start-prompt-button');

    if (!startPromptButton) {
        // If it doesn't exist, create it
        startPromptButton = document.createElement('button');
        startPromptButton.id = 'start-prompt-button';
        startPromptButton.textContent = "Let's start making a sculpture of your choice!";
        startPromptButton.onclick = startSculptureFlow;
        chatMessages.appendChild(startPromptButton);
    }

    // Ensure it's visible
    startPromptButton.style.display = '';
}

function createBackButton(text) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.backgroundColor = 'transparent';
    button.style.color = '#6082a6';
    button.style.padding = '6px 12px';
    button.style.border = '1px solid #6082a6';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '0.9em';
    button.style.marginLeft = 'auto'; // Pushes to right
    button.style.transition = 'all 0.2s ease';

    button.onmouseover = function () {
        this.style.backgroundColor = '#f0f4f8';
    };
    button.onmouseout = function () {
        this.style.backgroundColor = 'transparent';
    };

    return button;
}


//Close the modal
let closeBtn = document.querySelector(".close");
closeBtn.onclick = function () {
    closeModal();
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
    if (event.target == modal) {
        closeModal();
    }
};

// Drawing functionality

// Clear canvas button
document.getElementById('clearDrawingBtn').addEventListener('click', clearCanvas);

// Confirm drawing button
document.getElementById('confirmDrawingBtn').addEventListener('click', confirmDrawing);

// Call resizeCanvas on window resize
window.addEventListener('resize', resizeCanvas);

// Replace all stroke color event listeners with this single one:
document.getElementById('stroke').addEventListener('input', (e) => {
    ctx.strokeStyle = e.target.value; // Update color in real-time
});
// Remove this if it exists in your code:
document.getElementById('stroke').addEventListener('change', (e) => {
    ctx.strokeStyle = e.target.value;
});

// Global variable to store the current image data for feedback
let currentFeedbackImageData = null;

// Open inline feedback section after image generation
function openInlineFeedback(imageURL) {
    currentFeedbackImageData = imageURL; // Store the image URL (will be converted to Base64 later)
    const feedbackSection = document.getElementById('inlineFeedback');
    feedbackSection.style.display = 'block';

    // Reset stars and comment
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        star.classList.remove('active');
        star.style.color = '#ccc';
    });
    document.getElementById('feedbackComment').value = '';

    // Star rating logic
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const value = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => {
                s.classList.remove('active');
                s.style.color = parseInt(s.getAttribute('data-value')) <= value ? '#f1c40f' : '#ccc';
                if (parseInt(s.getAttribute('data-value')) <= value) {
                    s.classList.add('active');
                }
            });
        });
    });
}

// Close inline feedback section
function closeInlineFeedback() {
    const feedbackSection = document.getElementById('inlineFeedback');
    feedbackSection.style.display = 'none';
    currentFeedbackImageData = null;
}

// Handle feedback submission by sending data to server
function submitFeedback() {
    const stars = document.querySelectorAll('.star.active');
    const rating = stars.length;
    const comment = document.getElementById('feedbackComment').value;

    if (rating === 0) {
        alert('Please select a star rating before submitting.');
        return;
    }

    if (!currentFeedbackImageData) {
        alert('No image data available for feedback.');
        return;
    }

    // Prepare feedback data
    const feedbackData = {
        image_url: currentFeedbackImageData, // e.g., /static/uploads/sculpture_61be3d96.png
        rating: rating,
        comment: comment
    };

    console.log('Feedback data being sent:', feedbackData); // Debug log

    // Send feedback to server endpoint
    fetch('/submit_feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedbackData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || `Server error! status: ${response.status}`); });
        }
        return response.json();
    })
    .then(data => {
        console.log('Feedback submitted successfully:', data);
        closeInlineFeedback();
        alert('Thank you for your feedback!');
    })
    .catch(error => {
        console.error('Error submitting feedback:', error);
        alert(`Error submitting feedback: ${error.message}. Please check the server logs or console for details.`);
    });
}

// Event listeners for inline feedback
document.getElementById('submitFeedbackBtn').addEventListener('click', submitFeedback);
document.querySelector('.close-feedback').addEventListener('click', closeInlineFeedback);

