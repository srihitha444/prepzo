from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape


out = Path(__file__).with_name("nta-pyq-permission-request.docx")

paragraphs = [
    "Permission Request for NEET UG Previous Year Questions on Prepzo",
    "Subject: Request for written permission / usage clarification for NEET UG previous year question papers",
    "To whom it may concern,",
    "I am writing on behalf of Prepzo, an independent educational preparation platform for students. Prepzo is not affiliated with NTA, NEET, or any government examination body, and we take care not to present our platform as an official source or representative of the examination authority.",
    "We are building a Previous Year Questions practice section to help students revise in a structured way. The intended feature would allow students to practise NEET UG previous year questions year-wise, chapter-wise, and topic-wise, along with explanations, performance tracking, and learning analytics. The purpose is educational support only.",
    "Before making this feature publicly available, we would like to seek written permission or official clarification regarding the use of NEET UG previous year question paper content on our platform. In particular, we would appreciate guidance on whether Prepzo may display previous year questions and answer options for student practice, provide original explanations and analysis around those questions, organize questions by chapter, topic, and year, and mention clearly that Prepzo is independent and not affiliated with NTA or NEET.",
    "If there are specific attribution requirements, usage terms, restrictions, licensing procedures, or an alternate department/person we should contact for approval, kindly let us know. We are happy to follow the appropriate process and share any additional details about how the content would be presented to students.",
    "Until this is clarified, we are keeping the PYQ section marked as coming soon and are not positioning it as an official NEET/NTA product.",
    "We would be grateful for your guidance on the correct way to proceed.",
    "Warm regards,",
    "Prepzo Team",
    "Email: collab@prepzo.study",
    "Website: https://www.prepzo.study",
]


def paragraph(text: str) -> str:
    return f'<w:p><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'


document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(paragraph(text) for text in paragraphs)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>
"""

content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""

rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

with ZipFile(out, "w", ZIP_DEFLATED) as docx:
    docx.writestr("[Content_Types].xml", content_types_xml)
    docx.writestr("_rels/.rels", rels_xml)
    docx.writestr("word/document.xml", document_xml)

print(out.resolve())
