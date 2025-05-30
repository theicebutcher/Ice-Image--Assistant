import os
import base64
from flask import Flask, render_template, request, jsonify, session
import openai
from dotenv import load_dotenv
import json
from flask_cors import CORS
import uuid
from PIL import Image
import io
import logging
import requests
import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG)


# Load FAQ data (unchanged)
with open('faq.json', 'r', encoding='utf-8') as file:
    faq_data = json.load(file)

app = Flask(__name__)
CORS(app)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "default-secret-key")  # Required for sessions
app.config["UPLOAD_FOLDER"] = "static/uploads"

# Load OpenAI API key
load_dotenv()
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Helper function to encode images (unchanged)
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

def classify_prompt_type(prompt):
    classification_messages = [
        {
            "role": "system",
            "content": "You are a classification assistant. Based on the user's input, decide if they are asking for a sculpture to be generated, edit an image, or just get a text response. Reply with only one word: 'generate', 'edit', or 'text'."
        },
        {"role": "user", "content": prompt}
    ]
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=classification_messages
    )
    return response.choices[0].message.content.strip().lower()



def combine_images(image_paths, output_path):
    """Combines multiple images into one with a white background.
    Smaller images are resized to match the max height.
    Avoids combining duplicate images.
    """
    # First remove duplicates by checking file content
    unique_images = []
    seen_hashes = set()
    
    for path in image_paths:
        try:
            with Image.open(path) as img:
                # Create a hash of the image content
                img_hash = hash(img.tobytes())
                if img_hash not in seen_hashes:
                    seen_hashes.add(img_hash)
                    unique_images.append(path)
        except Exception as e:
            logging.warning(f"Could not process image {path}: {str(e)}")
            continue
    
    if not unique_images:
        raise ValueError("No valid images to combine")
    
    images = [Image.open(path) for path in unique_images]
    widths, heights = zip(*(i.size for i in images))

    max_height = max(heights)
    resized_images = []

    for img in images:
        width, height = img.size
        if height < max_height:
            # Maintain aspect ratio
            new_width = int((max_height / height) * width)
            img = img.resize((new_width, max_height), Image.LANCZOS)  # Updated from ANTIALIAS to LANCZOS
        resized_images.append(img)

    total_width = sum(img.size[0] for img in resized_images)
    new_im = Image.new('RGB', (total_width, max_height), color='white')

    x_offset = 0
    for img in resized_images:
        new_im.paste(img, (x_offset, 0))
        x_offset += img.size[0]

    new_im.save(output_path, format='JPEG')
from rapidfuzz import fuzz

# Function to check similarity
def is_similar_to_ludge(input_text, threshold=80):
    words = input_text.lower().split()
    return any(fuzz.ratio(word, "lobster") >= threshold for word in words)

# Dictionary mapping keywords to image filenames in static folder
SCULPTURE_BASES = {

    #Bases
    "champagne": os.path.join("bases", "champagne_base.png"),
    "crystal base": os.path.join("bases", "crystal_base.png"),
    "frame base": os.path.join("bases", "frame_base.png"),
    "golf base": os.path.join("bases", "golf_base.png"),
   
    "plynth base": os.path.join("bases", "plynth_base.png"),
    "ring base": os.path.join("bases", "ring_base.png"),
    "tee base": os.path.join("bases", "tee_base.png"),
    "waves base": os.path.join("bases", "waves_base.png"),

    ##ludges

    "double ludge": os.path.join("sculptures", "double_ludge.png"),
    "martini": os.path.join("sculptures", "martini.png"),
    "tube": os.path.join("sculptures", "tube.png"),

    #Sculptures
        "alligator head": os.path.join("sculptures", "alligator_head.png"),
        "alligator": os.path.join("sculptures", "alligator.png"),
        "anchor": os.path.join("sculptures", "anchor.png"),
        "crab claw": os.path.join("sculptures", "crab claw.png"),
        "dolphin": os.path.join("sculptures", "dolphin.png"),
        "dragon head": os.path.join("sculptures", "dragon_head.png"),
        "griffen": os.path.join("sculptures", "griffen.png"),
        "guitar": os.path.join("sculptures", "guitar.png"),
        "heel": os.path.join("sculptures", "heel.png"),
        "horse head": os.path.join("sculptures", "horse_head.png"),
        "indian head": os.path.join("sculptures", "indian head.png"),
        "leopard": os.path.join("sculptures", "leopard.png"),
        "lion": os.path.join("sculptures", "lion.png"),
        "lobster": os.path.join("sculptures", "lobster.png"),
       
        "mahi mahi": os.path.join("sculptures", "mahi mahi.png"),
        "mask": os.path.join("sculptures", "mask.png"),
        "mermaid": os.path.join("sculptures", "mermaid.png"),
        "palm_trees": os.path.join("sculptures", "palm_trees.png"),
        "panther": os.path.join("sculptures", "panther.png"),
        "penguin": os.path.join("sculptures", "penguin.png"),
        "selfish": os.path.join("sculptures", "selfish.png"),
        "shark": os.path.join("sculptures", "shark.png"),
        "shrimp": os.path.join("sculptures", "shrimp.png"),
        "turkey": os.path.join("sculptures", "turkey.png"),
        "turle": os.path.join("sculptures", "turle.png"),
        "turtle cartoon": os.path.join("sculptures", "turtle_cartoon.png"),
        "unicorn": os.path.join("sculptures", "unicorn.png"),
        "vase": os.path.join("sculptures", "vase.png"),
        "whale": os.path.join("sculptures", "whale.png"),
        "women butt": os.path.join("sculptures", "women_butt.png"),
        "women torso": os.path.join("sculptures", "women_torso.png"),

        #Wedding Sculptures
        "interlocking rings": os.path.join("wedding_Showpieces", "interlocking_rings_showpiece_wedding.png"),
        "wedding frame": os.path.join("wedding_Showpieces", "picture_frame_wedding.png"),

        #Topper
        "banana single luge": os.path.join("Toppers", "banana single luge.jpg"),
        "ice bar mini single luge": os.path.join("Toppers", "ice bar mini single luge.jpg"),
        "ice bowl": os.path.join("Toppers", "ice bowl.png"),
        "crown logo as topper": os.path.join("Toppers", "crown logo as topper.jpg"),
        "crown logo as topper": os.path.join("Toppers", "crown logo as topper.jpg"),
        "crown logo as topper": os.path.join("Toppers", "crown logo as topper.jpg"),
            
         #Ice Bars
        "6ft ice bar": os.path.join("Ice bars", "6ft ice bar.jpg"),
        "8ft ice bar":os.path.join("Ice bars", "8ft ice bar.jpg"),   
        "12ft ice bar": os.path.join("Ice bars", "12ft ice bar.jpg"),   
        
       
        
        

        #LOGOS
    # "logo base": os.path.join("bases", "logo_base.png"),
    # "logo plynth base": os.path.join("bases", "logo_plynth_base.png"),

    # Add more mappings as needed
}
LUDGE_TYPES = {
    "martini": os.path.join("sculptures", "martini.png"),
    "tube": os.path.join("sculptures", "tube.png"),
    "double": os.path.join("sculptures", "double_ludge.png")
}

REFERENCE_IMAGES = {
    "double luge": [
        "static/double luge/BOOMBOX Double LUGE w J LOGO  Render.jpg",  # Replace with the actual path to your first reference image
        "static/double luge/HAKU VODKA Logo on KANPAI Double Luge.jpg"  # Replace with the actual path to your second reference image
        # "/static/uploads/butcher_3.jpg",  # Replace with the actual path to your third reference image
        # "/static/uploads/butcher_4.jpg",  # Replace with the actual path to your fourth reference image
    ]
    # Add more mappings for other sculptures later, e.g., "martini luge": [...]
}

# Then modify your ludge detection logic:
def detect_ludge_type(input_text):
    input_text = input_text.lower()
    for ludge in LUDGE_TYPES:
        if ludge in input_text:
            return LUDGE_TYPES[ludge]
    return None

def detect_sculpture_bases(input_text, threshold=80):
    """Detects which sculpture bases are mentioned in the input text."""
    input_text = input_text.lower()
    detected_bases = []
    
    # First remove "base" from input to avoid matching all bases
    input_without_base = input_text.replace("base", "").strip()
    if not input_without_base:  # If only "base" was specified
        input_without_base = input_text  # Use original input
    
    for keyword, image_path in SCULPTURE_BASES.items():
        # Get the main descriptor (remove "base" from keyword)
        main_keyword = keyword.replace("base", "").strip()
        
        # Check if main descriptor is in input
        if main_keyword and main_keyword in input_without_base:
            detected_bases.append(image_path)
        # Original exact match check (for full phrases)
        elif keyword in input_text:
            detected_bases.append(image_path)
        # Fuzzy matching only on main descriptors
        else:
            words = input_without_base.split()
            if any(fuzz.ratio(word, main_keyword) >= threshold for word in words):
                detected_bases.append(image_path)
    
    return detected_bases

@app.route('/submit_feedback', methods=['POST'])
def submit_feedback():
    try:
        data = request.get_json()
        image_url = data.get('image_url')  # e.g., /static/uploads/sculpture_61be3d96.png
        rating = data.get('rating')
        comment = data.get('comment')

        # Validate inputs
        if not image_url or not rating:
            return jsonify({'error': 'Missing image_url or rating'}), 400

        # Convert relative URL to absolute file path
        base_dir = os.path.abspath(os.path.dirname(__file__))
        image_path = os.path.join(base_dir, 'static/uploads', os.path.basename(image_url))
        print(f"Attempting to read image from: {image_path}")  # Debug log

        if not os.path.exists(image_path):
            return jsonify({'error': f'Image file not found at {image_path}'}), 404

        # Read the image file and convert to Base64
        with open(image_path, 'rb') as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            print(f"Base64 length: {len(base64_image)}")  # Debug log

        # Prepare feedback data for Google Apps Script
        feedback_data = {
            'imageData': base64_image,
            'rating': rating,
            'comment': comment or 'No comment provided'
        }

        # Send to Google Apps Script web app
        script_url = 'https://script.google.com/macros/s/AKfycbyTNx59ui4DrCGQ7G87Z7ZTUIbUCIHbe7r9en33IuZQMY8jgyIMw2ElegY_dxQ_4kSo5Q/exec'  # Replace with your web app URL
        response = requests.post(script_url, json=feedback_data, timeout=30)
        print(f"Google Apps Script response status: {response.status_code}, text: {response.text}")  # Debug log

        if response.status_code != 200:
            return jsonify({'error': f'Failed to save feedback, status: {response.status_code}, response: {response.text}'}), 500

        return jsonify({'message': 'Feedback submitted successfully'}), 200

    except FileNotFoundError as e:
        print(f"FileNotFoundError: {str(e)}")
        return jsonify({'error': f'Image file not found: {str(e)}'}), 404
    except PermissionError as e:
        print(f"PermissionError: {str(e)}")
        return jsonify({'error': f'Permission denied accessing image: {str(e)}'}), 403
    except Exception as e:
        print(f"Unexpected error in submit_feedback: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route("/chatbot", methods=["POST"])
def chatbot():
    # Initialize conversation history if it doesn't exist
    if "conversation" not in session or not isinstance(session["conversation"], list):
        session["conversation"] = []

    # Limit conversation history size
    if len(session["conversation"]) > 5:
        session["conversation"] = session["conversation"][-5:]

    user_input = request.form.get("user_input", "").strip().lower()
    uploaded_files = request.files.getlist("images")
    logging.debug(f"Received request.files: {request.files}")

    # Check for ludge in user input
    detected_ludge = detect_ludge_type(user_input)

    # Check if user is asking about "Double Luge" and return reference images
    reference_images = None
    if "double luge" in user_input:
        reference_images = REFERENCE_IMAGES.get("double luge", [])

    if "ludge" in user_input and not detected_ludge and not reference_images:
        session["conversation"].append({"role": "user", "content": user_input})
        response = "Can you please specify which ludge? We have martini ludge, tube ludge, and double ludge."
        session["conversation"].append({"role": "assistant", "content": response})
        session.modified = True
        return jsonify({"response": response})

    # Detect base images from user input
    base_images = detect_sculpture_bases(user_input)

    if detected_ludge:
        base_images.append(detected_ludge)

    # If reference images are found, return them in the response
    if reference_images:
        session["conversation"].append({"role": "user", "content": user_input})
        response = "Here are some reference images for Double Luge to inspire you:"
        session["conversation"].append({
            "role": "assistant",
            "content": response,
            "reference_images": reference_images
        })
        session.modified = True
        return jsonify({
            "response": response,
            "reference_images": reference_images
        })
    # Detect base images from user input
    base_images = detect_sculpture_bases(user_input)

    if detected_ludge:
        base_images.append(detected_ludge)
        
    # If user uploaded images or we detected base images
    if uploaded_files or base_images:
        conversation_context = "\n".join(
            f"{msg['role']}: {msg['content']}" 
            for msg in session["conversation"]
        )
        
        # Save any uploaded files
        uploaded_paths = []
        if uploaded_files:
            uploaded_ids = [uuid.uuid4().hex[:8] for _ in uploaded_files]
            uploaded_paths = [os.path.join(app.config["UPLOAD_FOLDER"], f"uploaded_{id}.jpg") for id in uploaded_ids]
            for i, file in enumerate(uploaded_files):
                file.save(uploaded_paths[i])
                logging.debug(f"Saved uploaded file: {uploaded_paths[i]}")
        
        
        # Get full paths to any detected base images
        base_image_paths = [os.path.join("static", img) for img in base_images] if base_images else []
        

        combined_id = uuid.uuid4().hex[:8]
        combined_path = os.path.join(app.config["UPLOAD_FOLDER"], f"combined_{combined_id}.jpg")

        all_images = uploaded_paths + base_image_paths


        if all_images:
            try:
                # This will now automatically remove duplicates
                combine_images(all_images, combined_path)
                logging.debug(f"Combined image saved to: {combined_path}")
            except ValueError as e:
                return jsonify({"response": str(e)})
            except Exception as e:
                return jsonify({"response": f"Error combining images: {str(e)}"})
        else:
            return jsonify({"response": "No valid images provided"})

        # --- ICE CUBE SPECIAL RULES ---
        if is_ice_cube_request(user_input):
            image_generation_prompt = f"""
STRICT ICE CUBE RENDERING RULES:

1. CUBE SIZE:
   - The ice cube must be exactly 2 inches x 2 inches x 2 inches.

2. LOGO SIZE & PLACEMENT:
   - Logo must be no larger than 1.70" x 1.70".
   - Logo must be perfectly centered on the front face of the cube.

3. LOGO STYLES (choose based on user input, default to snowfilled if not specified):
   - Snowfilled (Etched): Engraved into the ice, filled with super white snow, no floating parts, all elements connected, clean and centered.
   - Paper Logo: Realistic print insert inside the ice, white background behind logo, no visible paper edges, perfectly centered, ice in front remains clear.
   - Paper + Snowfilled: Printed logo inside ice with matching snowfilled etching over it, perfectly aligned.
   - Color-Filled: Solid color fill inside etching, vibrant and fully visible, same sizing/placement rules.

4. ICE APPEARANCE:
   - Ice must look clear, wet, smooth, and realistic. Never blurry or frosty.
   - Always render with a wet, polished ice effect.

5. BACKGROUND:
   - Use the same lighting, angle, and surface as in the approved image "SKULL CUBE RENDER.jpg".

6. GENERAL RULES:
   - No floating letters or elements; all parts of the logo must be connected.
   - Logos must never exceed the visual limits of the cube face.
   - Do not stretch logos; preserve correct proportions.
   - No gaps between logo letters.
   - Logo should appear slightly embedded if snowfilled, or seamlessly layered if paper.
   - No foggy or frosty ice.

USER INPUT:
{user_input}
"""
        # --- END ICE CUBE SPECIAL RULES ---

        # Generate the ice sculpture using the combined image
        generation_id = uuid.uuid4().hex[:8]
        image_generation_prompt = f"""

               
        USER INPUT:
        {user_input}
       STRICT INSTRUCTIONS FOR ICE SCULPTURE GENERATION:

        1. SCULPTURE PRESERVATION:
           - Maintain EXACT shape, proportions, and details from the reference image
           - Do NOT alter, add, or remove any elements of the sculpture
           - Preserve all original contours and features precisely
        
        2. MATERIAL PROPERTIES:
           - Render as crystal-clear, see-through ice
           - Include realistic light refraction and subtle imperfections
           - Surface should appear smooth and polished

        3. BACKGROUND AND ENVIRONMENT
            -place the sculpture on a wooden table in a realistic environment or a country club.
        
        4. LIGHTING:
           - Maintain consistent lighting that showcases the sculpture
           - For ludges and showpieces, add rectangular base with subtle LED lighting
        
        5. PROHIBITED MODIFICATIONS:
           - NO changes to the sculpture structure
           - NO additional decorative elements
           - NO human figures or living creatures
           - no elements detached from the sculpture even if requested. You will never make floating, or bits and peices that are not connected with the sculpture
           - no small details
           - no foggy ice

        6.IMAGE QUALITY:
         -Always create an HD high resolution image, captured by a high resolution camera.

        
        Reference the provided image exactly as is.
        """
        
        try:
            with open(combined_path, "rb") as image_file:
                result = client.images.edit(
                    model="gpt-image-1",
                    image=image_file,
                    prompt=image_generation_prompt,
                )
            
            # Save the generated image
            output_id = uuid.uuid4().hex[:8]
            output_filename = f"sculpture_{output_id}.png"
            output_path = os.path.join(app.config["UPLOAD_FOLDER"], output_filename)

            image_bytes = base64.b64decode(result.data[0].b64_json)
            with open(output_path, "wb") as f:
                f.write(image_bytes)

            # Store in conversation history
            session["conversation"].append({"role": "user", "content": user_input})
            session["conversation"].append({
                "role": "assistant", 
                "content": "Here is your ice sculpture:",
                "image": f"/static/uploads/{output_filename}"
            })
            session.modified = True

            return jsonify({
                "response": "Here's your custom ice sculpture:",
                "image_url": f"/static/uploads/{output_filename}"
            })
        except Exception as e:
            return jsonify({"response": f"Error generating sculpture image: {str(e)}"})

    # Rest of your existing code remains the same...

    # If no images were uploaded or detected, proceed with text/classification flow
    try:
        classification = classify_prompt_type(user_input)
        print(f"Prompt classified as: {classification}")

        # --- ICE CUBE SPECIAL RULES FOR TEXT-ONLY GENERATION ---
        if is_ice_cube_request(user_input) and classification == "generate":
            generation_id = uuid.uuid4().hex[:8]
            image_generation_prompt = f"""
STRICT ICE CUBE RENDERING RULES:

1. CUBE SIZE:
   - The ice cube must be exactly 2 inches x 2 inches x 2 inches.

2. LOGO SIZE & PLACEMENT:
   - Logo must be no larger than 1.70" x 1.70".
   - Logo must be perfectly centered on the front face of the cube.

3. LOGO STYLES (choose based on user input, default to snowfilled if not specified):
   - Snowfilled (Etched): Engraved into the ice, filled with super white snow, no floating parts, all elements connected, clean and centered.
   - Paper Logo: Realistic print insert inside the ice, white background behind logo, no visible paper edges, perfectly centered, ice in front remains clear.
   - Paper + Snowfilled: Printed logo inside ice with matching snowfilled etching over it, perfectly aligned.
   - Color-Filled: Solid color fill inside etching, vibrant and fully visible, same sizing/placement rules.

4. ICE APPEARANCE:
   - Ice must look clear, wet, smooth, and realistic. Never blurry or frosty.
   - Always render with a wet, polished ice effect.

5. BACKGROUND:
   - Use the same lighting, angle, and surface as in the approved image "SKULL CUBE RENDER.jpg".

6. GENERAL RULES:
   - No floating letters or elements; all parts of the logo must be connected.
   - Logos must never exceed the visual limits of the cube face.
   - Do not stretch logos; preserve correct proportions.
   - No gaps between logo letters.
   - Logo should appear slightly embedded if snowfilled, or seamlessly layered if paper.
   - No foggy or frosty ice.

USER INPUT:
{user_input}
"""
            result = client.images.generate(
                model="gpt-image-1",
                prompt=image_generation_prompt,
            )

            output_filename = f"generated_{generation_id}.png"
            output_path = os.path.join(app.config["UPLOAD_FOLDER"], output_filename)

            image_bytes = base64.b64decode(result.data[0].b64_json)
            with open(output_path, "wb") as f:
                f.write(image_bytes)

            session["conversation"].append({"role": "user", "content": user_input})
            session["conversation"].append({
                "role": "assistant", 
                "content": "Here is your ice cube:",
                "image": f"/static/uploads/{output_filename}"
            })
            session.modified = True

            return jsonify({
                "response": "Here is your ice cube:",
                "image_url": f"/static/uploads/{output_filename}"
            })
        # --- END ICE CUBE SPECIAL RULES ---

        # Normal text conversation (with memory)
        if classification == "text":
            conversation_history = "\n".join(
                f"{msg['role'].capitalize()}: {msg['content']}" for msg in session["conversation"]
            )

            system_prompt = f"""You are an AI assistant for an ice sculpture company. You can create ice sculpture images 
            from text prompts using the latest GPT image generation model. You also accept image inputs for editing 
            based on user prompts. Never say you can't generate or edit images — just use the input prompt to create 
            a realistic ice sculpture.

            """

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input}
            ]

            completion = client.chat.completions.create(
                model="gpt-4o",
                messages=messages
            )

            gpt_response = completion.choices[0].message.content

            # Store in conversation history
            session["conversation"].append({"role": "user", "content": user_input})
            session["conversation"].append({"role": "assistant", "content": gpt_response})

            return jsonify({"response": gpt_response})

        # Image generation flow
        elif classification == "generate":
            conversation_context = "\n".join(
                f"{msg['role']}: {msg['content']}" 
                for msg in session["conversation"]
            )
            
            generation_id = uuid.uuid4().hex[:8]
            image_generation_prompt = f"""
        "task": "Generate realistic images of ice engravings based solely on user text input.",
        "instructions": 
            "design": "Accurately follow the user's text description with no creative additions or modifications.",
            "ice_quality": "Use natural, crystal-clear ice with realistic light refraction. No bubbles, rough edges, or imperfections.",
            "surface": "Ice must appear smooth, clean, and polished.",
            "detail_level": "Keep details minimal; emphasize the natural beauty of ice.",
            "structure": "Do not add any base or extra structure beyond what is described.",
            "creativity": "This is a technical execution. No creative interpretation.",
            "environment": "Place the sculpture the requested theme, but do not change the look of the sculpture until requested explicitly",
            "extra":"For all ludges and showpieces, add a retangular shape base with led light in the bottom so that it will light up the sculpture from the bottom",
            "small items":"do not add any items items that cannot be made by ice or that can be easily broken",
            "human_presence": "Do not include any humans in the image." 
            "user_input": {user_input}
    """
            
            result = client.images.generate(
                model="gpt-image-1",
                prompt=image_generation_prompt,
            )

            output_filename = f"generated_{generation_id}.png"
            output_path = os.path.join(app.config["UPLOAD_FOLDER"], output_filename)

            image_bytes = base64.b64decode(result.data[0].b64_json)
            with open(output_path, "wb") as f:
                f.write(image_bytes)

            session["conversation"].append({"role": "user", "content": user_input})
            session["conversation"].append({
                "role": "assistant", 
                "content": "Here is your ice sculpture:",
                "image": f"/static/uploads/{output_filename}"
            })
            session.modified = True

            return jsonify({
                "response": "Here is your ice sculpture:",
                "image_url": f"/static/uploads/{output_filename}"
            })

    except Exception as e:
        return jsonify({"response": f"Error: {str(e)}"})
    
def is_ice_cube_request(user_input):
    """Detect if the user is requesting an ice cube or ice cubes."""
    return "ice cube" in user_input or "ice cubes" in user_input

if __name__ == "__main__":
    if not os.path.exists(app.config["UPLOAD_FOLDER"]):
        os.makedirs(app.config["UPLOAD_FOLDER"])
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))