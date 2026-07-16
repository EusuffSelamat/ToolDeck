import pikepdf
import fitz

original_file = "TGS-2024050902_1_Completion Certificate (1).pdf"
clean_file = "cleaned_temp.pdf"
final_file = "TGS-2024050902_1_Completion Certificate.pdf"

# Step 1: Strip encryption/fix structure using pikepdf
print("Cleaning PDF structure...")
with pikepdf.open(original_file) as pdf:
    pdf.save(clean_file)

# Step 2: Edit the cleaned PDF using PyMuPDF
print("Editing text...")
doc = fitz.open(clean_file)
doc.save(final_file)
doc.close()

# Optional: Delete the temporary clean file
import os
os.remove(clean_file)

print(f"Success! Saved as {final_file}")
