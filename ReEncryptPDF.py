import pikepdf
import os

desktop = r"C:\Users\eusuff.binselamat\Desktop"

# File paths
edited_unencrypted = os.path.join(desktop, "TGS-2024050902_1_Completion Certificate.pdf")
temp_encrypted = os.path.join(desktop, "temp_reencrypted.pdf")

print("Applying encryption with Owner Password (to restrict editing)...")

try:
    # Open the edited unencrypted PDF
    edited_pdf = pikepdf.open(edited_unencrypted)
    
    # Create the encryption object
    # - user="" means it opens without a password prompt
    # - owner="owner_password" means editing/permissions are locked
    # - allow=Permissions(...) restricts editing, copying, etc.
    new_encryption = pikepdf.Encryption(
        owner="stunner256", 
        user="", 
        R=5,  # Keep it as Revision 5 (256-bit AES) to match the original
        allow=pikepdf.Permissions(
            accessibility=True,    # Allow screen readers for accessibility
            extract=False,         # Disable content extraction/copying
            modify_annotation=False,
            modify_assembly=False,
            modify_form=False,
            modify_other=False,    # Disable general editing
            print_highres=True,    # Allow printing
            print_lowres=True
        )
    )
    
    # Save with the encryption applied
    edited_pdf.save(temp_encrypted, encryption=new_encryption)
    edited_pdf.close()
    
    # Replace the edited file with the re-encrypted version
    os.replace(temp_encrypted, edited_unencrypted)
    print(f"\nSuccess! PDF is now locked down exactly like the original.")
    print(f"It will open without a password, but editing will require the owner password.")
    
except Exception as e:
    print(f"An error occurred: {e}")
