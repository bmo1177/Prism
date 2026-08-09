#!/usr/bin/env python3
import re

# Read and update DesignPage.tsx
with open('/home/devlab/Documents/Crafting/craft/apps/desktop/src/app/routes/DesignPage.tsx', 'r') as f:
    content = f.read()

# Add PageHeader import
if 'PageHeader' not in content:
    content = re.sub(
        r'import \{ useEffect, useState \} from "react";(\s*import \{.*?lucide-react\} from "lucide-react";)',
        r'import { useEffect, useState } from "react";\nimport { PageHeader } from "@/components/cards/PageHeader";\n\1',
        content
    )

# Replace the header structure in DesignPage - replace the "text-center" block with PageHeader
# Find the return statement and replace the design title/subtitle with PageHeader
pattern = r'(\s*return \(\s*<div className="h-full overflow-y-auto">\s*<div className="mx-auto max-w-6xl px-6 py-10">\s*)<div className="text-center">\s*<div className="text-\[10\.5px\].*?<\/p>\s*(<div className="mt-4">)'
replacement = r'\1<PageHeader icon={<Sparkles size={17} strokeWidth={1.75} />} title={t("design.title")} subtitle={t("design.subtitle")} />\2'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Fix any remaining text-white
content = re.sub(r'text-white', 'text-accent-fg', content)

with open('/home/devlab/Documents/Crafting/craft/apps/desktop/src/app/routes/DesignPage.tsx', 'w') as f:
    f.write(content)

print("✓ Updated DesignPage.tsx")

# Read and update SciencePage.tsx
with open('/home/devlab/Documents/Crafting/craft/apps/desktop/src/app/routes/SciencePage.tsx', 'r') as f:
    content = f.read()

# Add PageHeader import
if 'PageHeader' not in content:
    content = re.sub(
        r'import \{ useEffect, useState \} from "react";',
        r'import { useEffect, useState } from "react";
import { PageHeader } from "@/components/cards/PageHeader";',
        content
    )

# Replace the h1/h2 structure with PageHeader - look for h1 with text-[26px]
pattern = r'(\s*return \(\s*<div className="h-full overflow-y-auto">\s*<div className="mx-auto max-w-6xl px-6 py-10">\s*)<div className="text-center">\s*<div className="text-\[10\.5px\].*?<\/div>\s*(<div className="mt-8 grid.*?<\/div>)'
replacement = r'\1<PageHeader icon={<Atom size={17} strokeWidth={1.75} />} title={t("science.title")} subtitle={t("science.subtitle")} />\2'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('/home/devlab/Documents/Crafting/craft/apps/desktop/src/app/routes/SciencePage.tsx', 'w') as f:
    f.write(content)

print("✓ Updated SciencePage.tsx")

# Read and update ResearchPage.tsx
with open('/home/devlab/Documents/Crafting/craft/apps/desktop/src/app/routes/ResearchPage.tsx', 'r') as f:
    content = f.read()

# Add PageHeader import
if 'PageHeader' not in content:
    content = re.sub(
        r'import \{ useEffect, useState, type ReactNode \} from "react";',
        r'import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/cards/PageHeader";',
        content
    )

# Replace the h1/h2 structure with PageHeader - look for h1 with text-[26px]
pattern = r'(\s*return \(\s*<div className="h-full overflow-y-auto">\s*<div className="mx-auto max-w-6xl px-6 py-10">\s*)<div className="text-center">\s*<div className="text-\[10\.5px\].*?<\/div>\s*(<section className="mt-9">)'
replacement = r'\1<PageHeader icon={<FlaskConical size={17} strokeWidth={1.75} />} title={t("research.title")} subtitle={t("research.subtitle")} />\2'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('/home/devlab/Documents/Crafting/craft/apps/desktop/src/app/routes/ResearchPage.tsx', 'w') as f:
    f.write(content)

print("✓ Updated ResearchPage.tsx")