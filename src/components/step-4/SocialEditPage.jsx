import React from "react";
import {
  FaYoutube,
  FaInstagram,
  FaFacebook,
  FaLinkedin,
  FaTiktok,
  FaGoogle,
} from "react-icons/fa";

export default function SocialEditPage() {
  const [socialMediaPlatforms, setSocialMediaPlatforms] = React.useState([
    {
      name: "YouTube",
      icon: FaYoutube,
      title: "My YouTube title",
      description: "My YouTube description",
    },
    {
      name: "Instagram",
      icon: FaInstagram,
      title: "My Instagram title",
      description: "My Instagram description",
    },
    {
      name: "Facebook",
      icon: FaFacebook,
      title: "My Facebook title",
      description: "My Facebook description",
    },
    {
      name: "LinkedIn",
      icon: FaLinkedin,
      title: "My LinkedIn title",
      description: "My LinkedIn description",
    },
    {
      name: "TikTok",
      icon: FaTiktok,
      title: "My TikTok title",
      description: "My TikTok description",
    },
    {
      name: "Google My Business",
      icon: FaGoogle,
      title: "My Google My Business title",
      description: "My Google My Business description",
    },
  ]);

  const handleChange = (index, field, value) => {
    const updatedPlatforms = [...socialMediaPlatforms];
    updatedPlatforms[index][field] = value;
    setSocialMediaPlatforms(updatedPlatforms);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Social Edit Page</h1>

      <div className="border border-gray-300 rounded-lg p-4">
        <div className="grid grid-cols-[1fr_2fr_2fr] gap-4 p-2 text-lg font-semibold">
          <div>Social media</div>
          <div>Change title</div>
          <div>Change description</div>
        </div>

        {socialMediaPlatforms.map((platform, index) => (
          <div
            key={platform.name}
            className="grid grid-cols-[1fr_2fr_2fr] gap-4 p-2 items-center border-t border-gray-200"
          >
            <div className="flex gap-2 items-center">
              <platform.icon className="text-2xl" />
              <span className="text-lg">{platform.name}</span>
            </div>

            <input
              type="text"
              value={platform.title}
              onChange={(e) => handleChange(index, "title", e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-950"
            />

            <input
              type="text"
              value={platform.description}
              onChange={(e) =>
                handleChange(index, "description", e.target.value)
              }
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-950"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
