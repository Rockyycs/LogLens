import axios from "axios";

function Upload({ setData }) {
  const handleUpload = async (e) => {
    const file = e.target.files[0];

    let formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://127.0.0.1:5000/upload", formData);
      setData(res.data);
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  return (
    <div>
      <h2>Upload Log File</h2>
      <input type="file" onChange={handleUpload} />
    </div>
  );
}

export default Upload;
