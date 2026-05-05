import os

# Folder to scan (current directory)
ROOT_DIR = "."

# Output file
OUTPUT_FILE = "all_code_dump.txt"

# File extensions to include
INCLUDE_EXTENSIONS = (
    ".js", ".jsx", ".ts", ".tsx",
    ".py", ".html", ".css",
    ".json", ".md"
)

# Folders to ignore
IGNORE_DIRS = {"node_modules", ".git", "build", "dist", "__pycache__"}

def should_include(file):
    return file.endswith(INCLUDE_EXTENSIONS)

def main():
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        for root, dirs, files in os.walk(ROOT_DIR):
            # Remove ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

            for file in files:
                if should_include(file):
                    file_path = os.path.join(root, file)

                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()

                        out.write(f"\n{'='*80}\n")
                        out.write(f"FILE: {file_path}\n")
                        out.write(f"{'='*80}\n\n")
                        out.write(content)
                        out.write("\n\n")

                    except Exception as e:
                        out.write(f"\n[ERROR READING {file_path}: {e}]\n")

    print(f"\n✅ All code dumped into: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()