from PIL import Image, ImageChops

def make_transparent_and_center(input_path, output_path):
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()
        
        newData = []
        for item in datas:
            # Change all white (also shades of white)
            # to transparent
            if item[0] > 220 and item[1] > 220 and item[2] > 220:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
                
        img.putdata(newData)
        
        # Crop to bounding box of non-transparent pixels
        bg = Image.new("RGBA", img.size, (255, 255, 255, 0))
        diff = ImageChops.difference(img, bg)
        bbox = diff.getbbox()
        if bbox:
            img = img.crop(bbox)
        
        # Make a square image and center it
        max_size = max(img.size)
        # Add a bit of padding
        max_size = int(max_size * 1.1)
        
        new_img = Image.new("RGBA", (max_size, max_size), (255, 255, 255, 0))
        
        paste_x = (max_size - img.size[0]) // 2
        paste_y = (max_size - img.size[1]) // 2
        
        new_img.paste(img, (paste_x, paste_y), img)
        
        new_img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} and saved to {output_path}")
    except Exception as e:
        print(f"Error processing image: {e}")

make_transparent_and_center('image copy.png', 'logo-transparent.png')
make_transparent_and_center('image copy.png', 'favicon.png')
make_transparent_and_center('image copy.png', 'dc-logo.png')
make_transparent_and_center('image copy.png', 'favicon.ico')
